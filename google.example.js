function getGoogleOauthUrl(from) {
  const rootUrl = `https://accounts.google.com/o/oauth2/v2/auth`;
  const options = {
    redirect_uri: process.env.REACT_APP_GOOGLE_OAUTH_CALLBACK,
    client_id: process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    state: from,
  };

  const qs = new URLSearchParams(options);
  const oauthUrl = `${rootUrl}?${qs.toString()}`;
  return oauthUrl;
}

async function getGoogleOauthToken({ code }) {
  const rootURl = "https://oauth2.googleapis.com/token";

  const options = {
    code,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: `${process.env.DOMAIN}/api/auth/google/callback`,
    grant_type: "authorization_code",
  };

  try {
    const { data } = await axios.post(rootURl, qs.stringify(options), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return data;
  } catch (err) {
    console.log("Failed to fetch Google Oauth Token");
    throw err;
  }
}

async function getGoogleUser({ id_token, access_token }) {
  try {
    const { data } = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      {
        headers: { Authorization: `Bearer ${id_token}` },
      }
    );

    return data;
  } catch (err) {
    throw err;
  }
}

async function googleOauth(req, res) {
  const { code, state } = req.query;
  try {
    if (!code) throw new ResponseError(401, "Authorization code not provided!");

    const { id_token, access_token } = await getGoogleOauthToken({
      code,
    });
    const { name, verified_email, email } = await getGoogleUser({
      id_token,
      access_token,
    });

    if (!verified_email)
      throw new ResponseError(403, "Google account not verified");

    const userData = {
      email,
      full_name: name,
      password: null,
      is_verified: true,
      provider: "google",
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

    console.log("Google Oauth success");
    res.redirect(`${state}/oauth/success?token=${token}`);
  } catch (error) {
    console.log("Failed to authorize Google User:", error);
    res.redirect(
      `${process.env.FRONTEND_ORIGIN}/oauth/error?message=${
        error.message ?? error
      }`
    );
  }
}
