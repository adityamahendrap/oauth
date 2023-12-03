function addWwwToUrl(url) {
  if (url.indexOf("www.") === -1) {
    return url.replace(/^https?:\/\//, "$&www.");
  }
  return url;
}

function getTwitterOauthUrl() {
  const rootUrl = "https://twitter.com/i/oauth2/authorize";
  const options = {
    redirect_uri: addWwwToUrl(process.env.REACT_APP_TWITTER_OAUTH_CALLBACK),
    client_id: process.env.REACT_APP_TWITTER_OAUTH_CLIENT_ID,
    state: "state",
    response_type: "code",
    code_challenge: "y_SfRG4BmOES02uqWeIkIgLQAlTBggyf_G7uKT51ku8",
    code_challenge_method: "S256",
    scope: ["users.read", "tweet.read", "follows.read", "follows.write"].join(
      " "
    ),
  };

  const qs = new URLSearchParams(options);
  const oauthUrl = `${rootUrl}?${qs.toString()}`;
  return oauthUrl;
}

async function getTwitterOAuthToken(code) {
  try {
    const rootURl = "https://api.twitter.com/2/oauth2/token";
    const options = {
      client_id: process.env.TWITTER_OAUTH_CLIENT_ID,
      code_verifier: "8KxxO-RPl0bLSxX5AWwgdiFbMnry_VOKzFeIlVA7NoA",
      redirect_uri: addWwwToUrl(
        `${process.env.DOMAIN}/api/auth/twitter/callback`
      ),
      grant_type: "authorization_code",
    };

    const basicAuthToken = Buffer.from(
      `${process.env.TWITTER_OAUTH_CLIENT_ID}:${process.env.TWITTER_OAUTH_CLIENT_SECRET}`,
      "utf8"
    ).toString("base64");

    const res = await axios.post(
      rootURl,
      new URLSearchParams({ ...options, code }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuthToken}`,
        },
      }
    );

    return res.data;
  } catch (err) {
    throw err;
  }
}

async function getTwitterUser(accessToken) {
  try {
    const res = await axios.get("https://api.twitter.com/2/users/me", {
      headers: {
        "Content-type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return res.data.data ?? null;
  } catch (err) {
    throw err;
  }
}

async function twitterOauth(req, res) {
  const { code } = req.query;
  try {
    const twitterOAuthToken = await getTwitterOAuthToken(code);
    if (!twitterOAuthToken) {
      throw new ResponseError(401, "Failed to get twitter oauth token");
    }

    const twitterUser = await getTwitterUser(
      twitterOAuthToken.access_token
    );
    if (!twitterUser)
      throw new ResponseError(401, "Failed to get twitter user");

    const userData = {
      email: "user@twitter.com",
      full_name: twitterUser.name,
      password: null,
      is_verified: true,
      provider: "twitter",
    };
    const user = await userService.getOrCreateUser(userData);
    if (!user) {
      cosnole.log("Failed to get or create user");
      return res.redirect(
        `${process.env.FRONTEND_ORIGIN}/oauth/error?message=Failed to get or create user`
      );
    }

    const payload = {
      id: user.id,
      email: user.email,
      provider: user.provider,
      is_verified: user.is_verified,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    console.log("Twitter Oauth success");
    res.redirect(`${process.env.FRONTEND_ORIGIN}/oauth/success?token=${token}`);
  } catch (error) {
    console.log("Failed to authorize Twitter User:", error);
    res.redirect(
      `${process.env.FRONTEND_ORIGIN}/oauth/error?message=${
        error.message ?? error
      }`
    );
  }
}
