// !! Frontend redirect example,
// 🧢 you should attach this function to your oauth github login button
// export function getGitHubUrl(from) {
//   const rootURl = "https://github.com/login/oauth/authorize";

//   const options = {
//     client_id: import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID, //DOMAIN/api/auth/github
//     redirect_uri: import.meta.env.VITE_GITHUB_OAUTH_REDIRECT_URL,
//     scope: "user:email",
//     state: from,
//   };

//   const qs = new URLSearchParams(options);

//   return `${rootURl}?${qs.toString()}`;
// }

async function getGithubOathToken({ code }) {
  const rootUrl = "https://github.com/login/oauth/access_token";
  const options = {
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
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

    return data;
  } catch (err) {
    throw err;
  }
}

async function githubOauth(req, res, next) {
  const { code, state, error } = req.query;
  try {
    const pathUrl = state ?? "/";

    if (error) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/login`);
    }

    if (!code) {
      return res.status(401).json({
        status: "error",
        message: "Authorization code not provided!",
      });
    }

    const { access_token } = await authService.getGithubOathToken({ code });
    const { email, avatar_url, login } = await authService.getGithubUser({
      access_token,
    });

    if (!email) {
      return res.status(403).json({
        status: "fail",
        message:
          "You GitHub account does not have any public email address, please add one and try again",
      });
    }

    const userData = {
      email,
      username: login,
      profile: { picture: avatar_url },
      password: " ",
      isVerified: true,
      authType: "GitHub",
    };
    const user = await userService.updateOrInsertUser(userData);

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/oauth/error`);
    }

    const token = await new jose.SignJWT({ userId: user._id })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    res.cookie("token", token, {
      expires: new Date(Date.now() + 60 * 60 * 1000),
    });

    res.redirect(`${process.env.FRONTEND_ORIGIN}${pathUrl}`);
  } catch (err) {
    console.error("Failed to authorize GitHub User:", err);
    return res.redirect(`${process.env.FRONTEND_ORIGIN}/oauth/error`);
  }
}
