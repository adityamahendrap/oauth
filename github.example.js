function getGithubOauthUrl(from) {
  const rootURl = "https://github.com/login/oauth/authorize";

  const options = {
    client_id: process.env.REACT_APP_GITHUB_OAUTH_CLIENT_ID,
    redirect_uri: process.env.REACT_APP_GITHUB_OAUTH_CALLBACK,
    scope: "user:email",
    state: from,
  };

  const qs = new URLSearchParams(options);
  return `${rootURl}?${qs.toString()}`;
}

async function getGithubOathToken({ code }) {
  const rootUrl = "https://github.com/login/oauth/access_token";
  const options = {
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
    client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    code,
  };
  const queryString = qs.stringify(options);

  try {
    const { data } = await axios.post(`${rootUrl}?${queryString}`, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const decoded = qs.parse(data);

    return decoded;
  } catch (err) {
    throw err;
  }
}

async function getGithubUser({ access_token }) {
  try {
    const { data } = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    console.log(data);
    return data;
  } catch (err) {
    throw err;
  }
}

async function githubOauth(req, res, next) {
  const { code, error } = req.query;
  try {
    if (error) {
      console.log("Failed to authorize GitHub User:", error);
      return res.redirect(
        `${process.env.FRONTEND_ORIGIN}/oauth/error?message=${error}`
      );
    }

    if (!code) {
      return res.redirect(
        `${process.env.FRONTEND_ORIGIN}/oauth/error?message=Authorization code not provided`
      );
    }

    const { access_token } = await getGithubOathToken({ code });
    const { email, avatar_url, login } = await getGithubUser({
      access_token,
    });

    if (!email) {
      return res.status(403).json({
        message:
          "Your GitHub account does not have any public email address, please add one and try again",
        payload: null,
      });
    }

    const userData = {
      email,
      full_name: login,
      password: null,
      is_verified: true,
      provider: "github",
    };
    const user = await userService.getOrCreateUser(userData);

    if (!user) {
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

    res.redirect(`${process.env.FRONTEND_ORIGIN}/oauth/success?token=${token}`);
  } catch (err) {
    console.error("Failed to authorize GitHub User:", err);
    res.redirect(
      `${process.env.FRONTEND_ORIGIN}/oauth/error?message=${err.message ?? err}`
    );
  }
}
