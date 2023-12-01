import { Probot } from "probot";
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export = (app: Probot) => {
  app.on("issues.opened", async (context) => {
    // const issueComment = context.issue({
    //   body: "Thanks for opening this issue!",
    // });
    // await context.octokit.issues.createComment(issueComment);
    await prisma.issue.create({
      data: {
        githubId: context.payload.issue.id,
        assigneeId: context.payload.issue.assignee?.id
      }
    })
  });
  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return
    const issueComment = context.issue({
      body: "Thanks for issue_comment.created this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });
  app.on("issues.edited", async () => {
    // const issueComment = context.issue({
    //   body: "Thanks for issues.edited this issue!",
    // });
    // await context.octokit.issues.createComment(issueComment);
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
