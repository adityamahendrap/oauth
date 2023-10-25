// !! Frontend redirect example
// 🧢 you should attach this function to your oauth google login button
// export const getGoogleUrl = (from) => {
//   const rootUrl = `https://accounts.google.com/o/oauth2/v2/auth`;

//   const options = {
//     redirect_uri: import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT, //DOMAIN/api/auth/google
//     client_id: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
//     access_type: "offline",
//     response_type: "code",
//     prompt: "consent",
//     scope: [
//       "https://www.googleapis.com/auth/userinfo.profile",
//       "https://www.googleapis.com/auth/userinfo.email",
//     ].join(" "),
//     state: from,
//   };

//   const qs = new URLSearchParams(options);

//   return `${rootUrl}?${qs.toString()}`;
// };

async function getGoogleOauthToken ({ code }) {
  const rootURl = "https://oauth2.googleapis.com/token";

  const options = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${process.env.API_ENDPOINT}/api${path.GOOGLE_OAUTH}`,
    grant_type: "authorization_code",
  };
  
  try {
    const { data } = await axios.post(
      rootURl,
      qs.stringify(options),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return data;
  } catch (err) {
    console.log("Failed to fetch Google Oauth Token");
    throw err
  }
}

async function getGoogleUser ({ id_token, access_token }) {
  try {
    const { data } = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`, {
      headers: { Authorization: `Bearer ${id_token}` },
    });

    return data;
  } catch (err) {
    throw err
  }
}

async function googleOauth(req, res) {
  const { code, state } = req.query;
  try {
    const pathUrl = state || "/";

    if (!code) {
      return res.status(401).json({
        status: "fail",
        message: "Authorization code not provided!",
      });
    }

    const { id_token, access_token } = await getGoogleOauthToken({
      code,
    });
    const { name, verified_email, email, picture } =
      await getGoogleUser({ id_token, access_token });

    if (!verified_email) {
      return res.status(403).json({
        status: "fail",
        message: "Google account not verified",
      });
    }

    const userData = {
      email,
      username: name,
      profile: { picture },
      password: null,
      isVerified: true,
      authType: "Google",
    };
    const user = await userService.updateOrInsertUser(userData);

    if (!user)
      return res.redirect(`${process.env.FRONTEND_ORIGIN}/oauth/error`);

    const token = await new jose.SignJWT({ userId: user._id })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    res.cookie("token", token, {
      expires: new Date(Date.now() + 60 * 60 * 1000),
    });

    res.redirect(`${process.env.FRONTEND_ORIGIN}${pathUrl}`);
  } catch (err) {
    console.log("Failed to authorize Google User:", err);
    return res.redirect(`${process.env.FRONTEND_ORIGIN}/oauth/error`);
  }
}
