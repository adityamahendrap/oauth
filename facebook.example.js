function getFacebookOauthUrl() {
  const rootUrl = "https://www.facebook.com/v13.0/dialog/oauth";
  const options = {
    redirect_uri: process.env.REACT_APP_FACEBOOK_OAUTH_CALLBACK,
    client_id: process.env.REACT_APP_FACEBOOK_OAUTH_CLIENT_ID,
    scope: ["email", "public_profile"].join(" "),
    response_type: "code",
  };

  const qs = new URLSearchParams(options);
  const oauthUrl = `${rootUrl}?${qs.toString()}`;
  return oauthUrl;
}

async function getFacebookOAuthToken(code) {
  try {
    const { data } = await axios.get(
      "https://graph.facebook.com/v13.0/oauth/access_token",
      {
        params: {
          client_id: process.env.FACEBOOK_OAUTH_CLIENT_ID,
          client_secret: process.env.FACEBOOK_OAUTH_CLIENT_SECRET,
          redirect_uri: `${process.env.DOMAIN}/api/auth/facebook/callback`,
          code,
        },
      }
    );
    return data.access_token; // { access_token, token_type, expires_in }
  } catch (error) {
    console.log("Failed to get Facebook OAuth Token", error);
    throw error;
  }
}

async function getFacebookUserData(access_token) {
  try {
    const { data } = await axios.get("https://graph.facebook.com/me", {
      params: {
        fields: "id,email,first_name,last_name",
        access_token,
      },
    });
    return data; // { id, email, first_name, last_name }
  } catch (error) {
    throw error;
  }
}

async function facebookOauth(req, res) {
  const { code } = req.query;
  try {
    if (!code) throw new ResponseError(401, "Authorization code not provided");

    const access_token = await getFacebookOAuthToken(code);
    if (!access_token)
      throw new ResponseError(401, "Failed to get facebook oauth token");

    const account = await getFacebookUserData(access_token);
    if (!account) throw new ResponseError(401, "Failed to get facebook user");

    const userData = {
      email: account.email,
      full_name: account.first_name + " " + account.last_name,
      password: null,
      is_verified: true,
      provider: "facebook",
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

    console.log("Facebook Oauth success");
    res.redirect(`${process.env.FRONTEND_ORIGIN}/oauth/success?token=${token}`);
  } catch (error) {
    console.log("Failed to authorize Facebook:", error);
    res.redirect(
      `${process.env.FRONTEND_ORIGIN}/oauth/error?message=${
        error.message ?? error
      }`
    );
  }
}
