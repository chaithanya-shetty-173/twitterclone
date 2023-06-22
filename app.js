const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jsonMiddleware = express.json();

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("The server is running at port:3000");
    });
  } catch (e) {
    console.log(`Db Error:${e.message}`);
  }
};
initializeDbAndServer();

//Authenticate Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 1
app.use(express.json());
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(hashedPassword);
  const getUserQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const dbResponse = await db.get(getUserQuery);
  console.log(dbResponse);
  if (dbResponse == undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const addUserQuery = `
      INSERT INTO 
      user(name,username,password,gender)
      VALUES(
          '${name}',
          '${username}',
          '${hashedPassword}',
          '${gender}'
      );`;
      const dbResponse = await db.run(addUserQuery);
      console.log(dbResponse.lastID);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2
app.post("/login/", async (request, response) => {
  console.log("feee");
  const { username, password } = request.body;
  const getUserQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const dbResponse = await db.get(getUserQuery);
  console.log(dbResponse);
  if (dbResponse == undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbResponse.password
    );
    if (isPasswordMatched === true) {
      console.log(isPasswordMatched);
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      response.status(200);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const user = await db.get(getUserNameQuery);
  console.log(user);
  console.log("hello");
  const userId = user.user_id;
  const getTweetsQuery = `
    SELECT user.username,tweet.tweet,tweet.date_time AS dateTime
    FROM follower 
    INNER JOIN tweet 
    ON follower.following_user_id=tweet.user_id
    INNER JOIN user
    ON follower.following_user_id=user.user_id
    WHERE follower.follower_user_id=${userId}
    ORDER BY tweet.date_time DESC
    LIMIT 4
    OFFSET 0;`;
  const tweets = await db.all(getTweetsQuery);
  console.log(tweets);
  response.status(200);
  response.send(tweets);
  return tweets;
});

//API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const user = await db.get(getUserNameQuery);
  console.log(user);
  const userId = user.user_id;
  const getFollowingQuery = `
  SELECT user.name
  FROM follower 
  INNER JOIN user 
  ON follower.following_user_id=user.user_id
  WHERE follower.follower_user_id=${userId};`;
  const following_list = await db.all(getFollowingQuery);
  response.status(200);
  response.send(following_list);
});

//API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const user = await db.get(getUserNameQuery);
  console.log(user);
  const userId = user.user_id;
  const getFollowingQuery = `
  SELECT user.name
  FROM follower 
  INNER JOIN user 
  ON follower.follower_user_id=user.user_id
  WHERE follower.following_user_id=${userId};`;
  const following_list = await db.all(getFollowingQuery);
  response.status(200);
  response.send(following_list);
});

//API 6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const user = await db.get(getUserNameQuery);
  const userId = user.user_id;

  let { tweetId } = request.params;
  const getTweetUserId = `
  SELECT user_id
  FROM tweet
  WHERE tweet_id=${tweetId};`;
  const tUser_idOBJ = await db.get(getTweetUserId);
  const tUser_id = tUser_idOBJ.user_id;
  console.log("tweetowunerid");
  console.log(tUser_id);
  const getFollowingQuery = `
  SELECT *
  FROM follower 
  INNER JOIN user 
  ON follower.following_user_id=user.user_id
  WHERE follower.follower_user_id=${userId};`;
  const following_list = await db.all(getFollowingQuery);
  console.log(following_list);
  const accept = following_list.some((us) => {
    return us.following_user_id == tUser_id;
  });
  console.log(accept);
  if (accept) {
    const getTweetStatsQuery = `
      SELECT tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id) AS replies,tweet.date_time AS dateTime
      FROM tweet
      INNER JOIN reply
      ON tweet.tweet_id=reply.tweet_id
      INNER JOIN like
      ON tweet.tweet_id=like.tweet_id
      WHERE tweet.tweet_id=${tweetId};`;
    const output = await db.get(getTweetStatsQuery);
    console.log(output);
    response.status(200);
    response.send(output);
  } else {
    response.status(400);
    response.send("Invalid Request");
  }
});

//API 7
app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
    const user = await db.get(getUserNameQuery);
    const userId = user.user_id;

    let { tweetId } = request.params;
    console.log(tweetId);
    const getTweetUserId = `
  SELECT user_id
  FROM tweet
  WHERE tweet_id=${tweetId};`;
    const tUser_idOBJ = await db.get(getTweetUserId);
    const tUser_id = tUser_idOBJ.user_id;
    console.log("tweetowunerid");
    console.log(tUser_id);
    const getFollowingQuery = `
  SELECT *
  FROM follower 
  INNER JOIN user 
  ON follower.following_user_id=user.user_id
  WHERE follower.follower_user_id=${userId};`;
    const following_list = await db.all(getFollowingQuery);
    console.log(following_list);
    const accept = following_list.some((us) => {
      return us.following_user_id == tUser_id;
    });
    console.log(accept);
    if (accept) {
      console.log("hello");
      const getLikedUserList = `
      SELECT *
      FROM tweet
      INNER JOIN like
      ON tweet.tweet_id=like.tweet_id
      WHERE tweet.tweet_id=${tweetId};`;
      const tweetLikesList = await db.all(getLikedUserList);
      const user_list = tweetLikesList.map((user) => {
        return user.user_id;
      });

      console.log(tweetLikesList);
      console.log(user_list);
      const getUserNamesList = `
      SELECT *
      FROM user;`;
      const user_name = await db.all(getUserNamesList);
      console.log(user_name);
      const final_list = [];
      user_name.forEach((user) => {
        if (user_list.includes(user.user_id)) {
          final_list.push(user.username);
        }
      });
      console.log(final_list);
      const final_result = {
        likes: final_list,
      };
      response.send(final_result);
      response.status(200);
    } else {
      response.status(400);
      response.send("Invalid Request");
    }
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
    const user = await db.get(getUserNameQuery);
    const userId = user.user_id;

    let { tweetId } = request.params;
    console.log(tweetId);
    const getTweetUserId = `
  SELECT user_id
  FROM tweet
  WHERE tweet_id=${tweetId};`;
    const tUser_idOBJ = await db.get(getTweetUserId);
    const tUser_id = tUser_idOBJ.user_id;
    console.log("tweetowunerid");
    console.log(tUser_id);
    const getFollowingQuery = `
  SELECT *
  FROM follower 
  INNER JOIN user 
  ON follower.following_user_id=user.user_id
  WHERE follower.follower_user_id=${userId};`;
    const following_list = await db.all(getFollowingQuery);
    console.log(following_list);
    const accept = following_list.some((us) => {
      return us.following_user_id == tUser_id;
    });
    console.log(accept);
    if (accept) {
      console.log("hello");
      const getRepliedUserList = `
      SELECT user.name,reply.reply
      FROM tweet
      INNER JOIN reply
      ON tweet.tweet_id=reply.tweet_id
      INNER JOIN user
      ON reply.user_id=user.user_id
      WHERE tweet.tweet_id=${tweetId};`;
      const tweetRepliesList = await db.all(getRepliedUserList);
      console.log({
        replies: tweetRepliesList,
      });
      response.status(200);
      response.send({
        replies: tweetRepliesList,
      });
    } else {
      response.status(400);
      response.send("Invalid Request");
    }
  }
);

//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const user = await db.get(getUserNameQuery);
  const userId = user.user_id;
  const getTweetsQuery = `
  SELECT tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id)AS replies,tweet.date_time AS dateTime
  FROM tweet
  INNER JOIN like
  ON tweet.tweet_id=like.tweet_id
  INNER JOIN reply
  ON tweet.tweet_id=reply.tweet_id
  WHERE tweet.user_id=${userId}
  GROUP BY tweet.tweet_id;`;
  const tweets_list = await db.all(getTweetsQuery);
  console.log(tweets_list);
  response.status(200);
  response.send(tweets_list);
});

//API 10
var format = require("date-fns/format");
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  let { username } = request;
  const now = new Date();
  const options = { timeZone: "Asia/Kolkata" };
  const istDateTime = now.toLocaleString("en-US", options);
  console.log(istDateTime);

  const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const user = await db.get(getUserNameQuery);
  const userId = user.user_id;
  console.log(userId);
  const postTweet = `
  INSERT INTO
  tweet (tweet,user_id,date_time)
  VALUES(${tweet},${userId},${istDateTime});`;
  const dbResponse = await db.run(postTweet);
  console.log(dbResponse.lastID);
});

//API 11
app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserNameQuery = `
  SELECT *
  FROM user
  WHERE username='${username}';`;
  const user = await db.get(getUserNameQuery);
  const userId = user.user_id;
  console.log(userId);

  let { tweetId } = request.params;
  console.log(tweetId);
  const getTweetUserId = `
  SELECT user_id
  FROM tweet
  WHERE tweet_id=${tweetId};`;
  const tUser_idOBJ = await db.get(getTweetUserId);
  const tUser_id = tUser_idOBJ.user_id;
  console.log("tweetowunerid");
  console.log(tUser_id);

  const getFollowingQuery = `
  SELECT *
  FROM follower 
  INNER JOIN user 
  ON follower.following_user_id=user.user_id
  WHERE follower.follower_user_id=${userId};`;
  const following_list = await db.all(getFollowingQuery);
  console.log(following_list);
  const accept = following_list.some((us) => {
    return us.following_user_id == tUser_id;
  });
  console.log(accept);
  if (accept) {
    const deleteTweetQuery = `
    DELETE FROM 
    tweet
    WHERE 
    tweet_id=${tweetId};`;
    await db.run(deleteTweetQuery);
    response.status(200);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
