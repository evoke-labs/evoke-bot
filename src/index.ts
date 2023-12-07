// @ts-nocheck
import {Probot} from "probot";
import {PrismaClient} from "@prisma/client";
import {Context} from "probot/lib/context";
import {PointAllocationType} from ".prisma/client";
import moment from "moment-timezone";

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

const overview_issues = [
    {
        issue_number: 5,
        repo: 'fund-management'
    }
]

const labelsWithColors = [
    {
        name: "bug",
        color: "d73a4a",
    },
    {
        name: "documentation",
        color: "0075ca",
    },
    {
        name: "duplicate",
        color: "cfd3d7",
    },
    {
        name: "wontfix",
        color: "ffffff",
    },
    {
        name: "enhancement",
        color: "a2eeef",
    },
    {
        name: "cant-reproduce",
        color: "ffffff",
    },
    {
        name: "help-wanted",
        color: "008672",
    },
    {
        name: "in-progress",
        color: "fbca04",
    },
    {
        name: "blocked",
        color: "e11d21",
    },
    {
        name: "needs-review",
        color: "fbca04",
    },
    {
        name: "needs-testing",
        color: "fbca04",
    },
    {
        name: "needs-merge",
        color: "fbca04",
    },
    {
        name: "need-point-revaluation",
        color: "fbca04",
    },
    {
        name: "high-priority",
        color: "e11d21",
    },
    {
        name: "low-priority",
        color: "d4c5f9",
    },
];

const adminUsers = ["Chathu94", "KrishEvoke"];

const reCreateLabels = async (context: Context) => {
    const labels = await context.octokit.issues.listLabelsForRepo(context.repo());
    const labelNames = labels.data.map((label) => label.name);
    await Promise.all(
        labelNames.map((labelName) =>
            context.octokit.issues.deleteLabel({
                ...context.repo(),
                name: labelName,
            }),
        ),
    );
    await Promise.all(
        labelsWithColors.map((label) =>
            context.octokit.issues.createLabel({...context.repo(), ...label}),
        ),
    );
};

const reCreateIssue = async (context: Context<"issues">) => {
    const issue = await prisma.issue.findUnique({
        where: {
            githubId: context.payload.issue.id,
        },
    });
    if (issue) {
        await prisma.issue.delete({
            where: {
                id: issue.id,
            },
        });
    }
    const created = await prisma.issue.create({
        data: {
            githubId: context.payload.issue.id,
            assigneeId: context.payload.issue.assignee?.id,
        },
    });
    // Re-Link Point Allocations
    if (issue)
        await prisma.pointAllocation.updateMany({
            where: {
                issueId: issue.id,
            },
            data: {
                issueId: created.id,
            },
        });
};

const commentWithMarkdown = (body: string) => {
    return `<!--- bot-comment -->\n${body}\n<!--- /bot-comment -->`;
};

const commandSuccessWithMarkdown = (body: string) => {
    return `> [!NOTE]
> ${body}`;
};

const commandErrorWithMarkdown = (body: string) => {
    // show GitHub markdown for code
    return `> [!CAUTION]
> ${body}`;
};

const comment = (context: Context, body: string) => {
    return context.octokit.issues.createComment({
        ...context.issue(),
        body: commentWithMarkdown(body),
    });
};

const checkIfCommenterIsAdmin = (context: Context<"issue_comment.created">) =>
    adminUsers.includes(context.payload.comment.user.login);

const checkIfCommenterIsAssignee = (context: Context<"issue_comment.created">) => {
    if (!context.payload.issue.assignee) return false
    return context.payload.issue.assignee.login == context.payload.comment.user.login
}

const regenerateOverview = async (context: Context<"issues.assigned" | "issue_comment.created" | "issues.reopened">) => {
    const previousWeekMonday = moment().subtract(1, 'weeks').startOf('isoWeek')
    const latePreviousWeekMonday = moment().subtract(2, 'weeks').startOf('isoWeek')
    const thisWeekMonday = moment().startOf('isoWeek')

    const checkWeekBracket = (date: Date) => {
        if (moment(date).isAfter(thisWeekMonday)) return 0
        if (moment(date).isAfter(previousWeekMonday)) return 1
        return 2
    }

    const pointsThisWeek = await prisma.pointAllocation.findMany({
        where: {
            // approvedAt: {
            //     gt: latePreviousWeekMonday.toDate(),
            // }
        }
    })
    const pointsByWeekAndAllocatedTo = pointsThisWeek?.filter(pa => !!pa.allocatedTo).reduce((a, pa) => ({
        ...a,
        [checkWeekBracket(pa.approvedAt)]: {
            ...(a[checkWeekBracket(pa.approvedAt)] ?? {}),
            [pa.allocatedTo]: pa.points + (a[checkWeekBracket(pa.approvedAt)]?.[pa.allocatedTo] ?? 0)
        }
    }), {})
    console.log('pointsByWeekAndAllocatedTo', pointsByWeekAndAllocatedTo)
    // Generate Week Table
    const generateTable = (pointsByWeekAndAllocatedTo: any) => `| User | Points |
| --- | --- |
${Object.entries(pointsByWeekAndAllocatedTo ?? {}).map(([user, points]) => `| ${user} | ${points} |`).join('\n')}
`;
    // Generate Current Week Table
    const week0Table = generateTable(pointsByWeekAndAllocatedTo[0])
    const week1Table = generateTable(pointsByWeekAndAllocatedTo[1])
    const week2Table = generateTable(pointsByWeekAndAllocatedTo[2])

    // Loop through issues and update overview
    await Promise.all(overview_issues.map(async (issue) => {
        const newOverviewComment = `<!--- bot-overview-week -->

## Current Week (${thisWeekMonday.format('DD/MM/YYYY')} - ${moment().endOf('isoWeek').format('DD/MM/YYYY')})
${week0Table}
<!--- /bot-overview-week -->

## Previous Week (${previousWeekMonday.format('DD/MM/YYYY')} - ${moment().subtract(1, 'weeks').endOf('isoWeek').format('DD/MM/YYYY')})
${week1Table}
<!--- /bot-overview-week -->

## Late Previous Week (${latePreviousWeekMonday.format('DD/MM/YYYY')} - ${moment().subtract(2, 'weeks').endOf('isoWeek').format('DD/MM/YYYY')})
${week2Table}
<!--- /bot-overview-week -->`
        await context.octokit.issues.update({
            owner: 'evoke-labs',
            issue_number: issue.issue_number,
            repo: issue.repo,
            body: newOverviewComment
        })
    }))
}

const generateIssueOverview = async (context: Context<"issue_comment.created">) => {
    const generateTable = async () => {
        const issue = await prisma.issue.findUnique({
            where: {
                githubId: context.payload.issue.id,
            },
        });
        const pointAllocations = await prisma.pointAllocation.findMany({
            where: {
                issueId: issue.id,
            },
        });
        const existingContent = context.payload.issue.body ?? '';
        const regex = /([\s\S]*?)<!---\s*bot-issue-overview\s*-->/;
        const match = existingContent.match(regex);
        const existingContentBeforeTable = match ? match[1] : '';

        return `${existingContentBeforeTable}<!--- bot-issue-overview -->
*Do not edit things below this line*
## Issue Overview
| ID | Points | Type | Requested By | Allocated To | Approved By | Approved At |
| --- | --- | --- | --- | --- | --- | --- |
${pointAllocations
            .map(
                (pa) =>
                    `| ${pa.id} | ${pa.points} | ${pa.type} | ${pa.requestedBy} | ${pa.allocatedTo} | ${pa.approvedBy} | ${moment(pa.approvedAt)?.format('DD-MMMM-YYYY hh:mm')} |`,
            )
            .join("\n")}`;
    }

    const table = await generateTable()
    await context.octokit.issues.update({
        ...context.issue(),
        body: table
    })
}

const checkAndHandlePointRevaluationNeededLabel = async (
    context: Context<"issue_comment.created">,
) => {
    const hasLabel = context.payload.issue.labels?.find(
        (label) => label.name === "need-point-revaluation",
    );
    let needLabel = false;
    // Check if Asignee points allocation exists
    const issue = await prisma.issue.findUnique({
        where: {
            githubId: context.payload.issue.id,
        },
    });
    if (!issue)
        throw new Error(
            "Issue not found. Please re-create issue using /bot admin re-create-issue",
        );
    const pointAllocations = await prisma.pointAllocation.findMany({
        where: {
            issueId: issue.id,
        },
    });
    if (!pointAllocations.find((pa) => pa.type === "Assignee")) {
        needLabel = true;
    }
    // Check if un-approved points allocation exists
    if (pointAllocations.find((pa) => !pa.approvedAt && !pa.rejectedAt)) {
        needLabel = true;
    }
    if (!pointAllocations) needLabel = false;
    if (!needLabel && hasLabel) {
        await context.octokit.issues.removeLabel({
            ...context.issue(),
            name: "need-point-revaluation",
        });
    }
    if (needLabel && !hasLabel) {
        await context.octokit.issues.addLabels({
            ...context.issue(),
            labels: ["need-point-revaluation"],
        });
    }
};

const handleAssignees = async (context: Context<"issues.assigned" | "issues.unassigned">) => {
    const issue = await prisma.issue.findUnique({
        where: {
            githubId: context.payload.issue.id,
        },
    });
    if (!issue)
        throw new Error(
            "Issue not found. Please re-create issue using /bot admin re-create-issue",
        );

    const existingPoint = await prisma.pointAllocation.findFirst({
        where: {
            issueId: issue.id,
            type: "Assignee"
        },
    });
    if (existingPoint) {
        // Edit assignee
        await prisma.pointAllocation.update({
            where: {
                id: existingPoint.id
            },
            data: {
                allocatedTo: context.payload.issue.assignee ? context.payload.issue.assignee.login : null
            }
        })
    } else {
        throw new Error(
            "No points allocated. Please allocate points using /bot point allocate [points]",
        );
    }
    await generateIssueOverview(context)
}

export = (app: Probot) => {
    app.log.info("Yay, the app was loaded!");
    app.on("repository.created", async (context) => {
        app.log.info("Repository initialing");
        app.log.info("Creating labels");
        await reCreateLabels(context);
        app.log.info("Labels created");
    });

    app.on("issues.opened", async (context) => {
        await reCreateIssue(context as any);
        // Check if has proper labels
        const labels = context.payload.issue.labels?.map((label) => label.name);
        if (!labels?.includes("bug") && !labels?.includes("enhancement")) {
            await comment(
                context,
                commandErrorWithMarkdown(
                    "Please add bug or enhancement label to the issue",
                ),
            );
        }
        // Check if has points in db
        const issue = await prisma.issue.findUnique({
            where: {
                githubId: context.payload.issue.id,
            },
        });
        if (!issue)
            throw new Error(
                "Issue not found. Please re-create issue using /bot admin re-create-issue",
            );
        const pointAllocations = await prisma.pointAllocation.findMany({
            where: {
                issueId: issue.id,
            },
        });
        if (!pointAllocations.find((pa) => pa.type === "Assignee")) {
            // Add label
            await context.octokit.issues.addLabels({
                ...context.issue(),
                labels: ["need-point-revaluation"],
            });
        }
        await generateIssueOverview(context)
    });
    app.on("issues.assigned", async (context) => {
        try {
            await handleAssignees(context)
        } catch (e: any) {
            await comment(context, commandErrorWithMarkdown(e.message));
        }
    });
    app.on("issues.unassigned", async (context) => {
        try {
            await handleAssignees(context)
        } catch (e: any) {
            await comment(context, commandErrorWithMarkdown(e.message));
        }
    });
    app.on("issue_comment.created", async (context) => {
        if (context.isBot) return;
        // Check if comment is bot command
        const command = context.payload.comment.body;
        const parts = command.split(" ");
        if (parts.length < 2 || parts[0] !== "/bot") return;
        try {
            if (parts.includes("-d")) {
                await context.octokit.issues.deleteComment({
                    ...context.issue(),
                    comment_id: context.payload.comment.id,
                });
            }
            switch (parts[1]) {
                case "issue-overview":
                    await generateIssueOverview(context)
                    break;
                case "regenerate-overview":
                    await regenerateOverview(context)
                    break;
                case "assign":
                    const assignee = parts[2];
                    await context.octokit.issues.addAssignees({
                        ...context.issue(),
                        assignees: [assignee],
                    });
                    break;
                case "unassign":
                    const unassignee = parts[2].startsWith("@")
                        ? parts[2].slice(1)
                        : parts[2];
                    await context.octokit.issues.removeAssignees({
                        ...context.issue(),
                        assignees: [unassignee],
                    });
                    break;
                case "label":
                    await context.octokit.issues.addLabels({
                        ...context.issue(),
                        labels: [parts[2]],
                    });
                    break;
                case "unlabel":
                    await context.octokit.issues.removeLabel({
                        ...context.issue(),
                        name: parts[2],
                    });
                    break;
                case "close":
                    await context.octokit.issues.update({
                        ...context.issue(),
                        state: "closed",
                    });
                    break;
                case "reopen":
                    await context.octokit.issues.update({
                        ...context.issue(),
                        state: "open",
                    });
                    break;
                case "comment":
                    await context.octokit.issues.createComment({
                        ...context.issue(),
                        body: parts.slice(2).join(" "),
                    });
                    break;
                case "point":
                    if (!parts[2]) return;
                    const issue = await prisma.issue.findUnique({
                        where: {
                            githubId: context.payload.issue.id,
                        },
                    });
                    if (!issue)
                        throw new Error(
                            "Issue not found. Please re-create issue using /bot admin re-create-issue",
                        );
                    switch (parts[2]) {
                        case "allocate":
                            if (!checkIfCommenterIsAdmin(context)) {
                                await comment(
                                    context,
                                    commandErrorWithMarkdown("Only admins can allocate points"),
                                );
                                return;
                            }
                            if (!parts[3]) return;
                            const points = parseInt(parts[3]);
                            if (!points || points < 0 || isNaN(points))
                                throw new Error("Invalid points");


                            if (parts[4] && !Object.values(PointAllocationType).includes(parts[4] as any))
                                throw new Error(
                                    "Invalid type. Use one of " +
                                    Object.values(PointAllocationType).join(", "),
                                );
                            const type = parts[4] as PointAllocationType ?? null;

                            const existingPoint = await prisma.pointAllocation.findFirst({
                                where: {
                                    type: type ?? "Assignee",
                                    issueId: issue.id,
                                },
                            });

                            if (existingPoint) {
                                await prisma.pointAllocation.update({
                                    where: {
                                        id: existingPoint.id
                                    },
                                    data: {
                                        points: points,
                                        approvedAt: new Date(),
                                        allocatedTo: context.payload.issue.assignee ? context.payload.issue.assignee : null,
                                        approvedBy: context.payload.comment.user.login,
                                    },
                                });
                            } else {
                                await prisma.pointAllocation.create({
                                    data: {
                                        points,
                                        type: type ?? "Assignee",
                                        issueId: issue.id,
                                        approvedAt: new Date(),
                                        allocatedTo: context.payload.issue.assignee.login ?? null,
                                        approvedBy: context.payload.comment.user.login,
                                    },
                                });
                            }


                            await checkAndHandlePointRevaluationNeededLabel(context);
                            await comment(
                                context,
                                commandSuccessWithMarkdown("Points allocated"),
                            );
                            break;
                        case "request":
                            if (!checkIfCommenterIsAssignee(context) && !checkIfCommenterIsAdmin(context)) {
                                await comment(
                                    context,
                                    commandErrorWithMarkdown("Only admins or assignees can request"),
                                );
                                return;
                            }
                            if (!parts[3] || !parts[4] || !parts[5]) return;
                            const allocatedTo = parts[3].startsWith("@")
                                ? parts[3].slice(1)
                                : parts[3];
                            const pointsRequested = parseInt(parts[4]);
                            if (
                                !pointsRequested ||
                                pointsRequested < 0 ||
                                isNaN(pointsRequested)
                            )
                                throw new Error("Invalid points");
                            if (!Object.values(PointAllocationType).includes(parts[5] as any))
                                throw new Error(
                                    "Invalid type. Use one of " +
                                    Object.values(PointAllocationType).join(", "),
                                );
                            const type = parts[5] as PointAllocationType;

                            const existingPoint = await prisma.pointAllocation.findFirst({
                                where: {
                                    type: type,
                                    allocatedTo: allocatedTo,
                                    issueId: issue.id,
                                },
                            });

                            if (existingPoint) {
                                await prisma.pointAllocation.update({
                                    where: {
                                        id: existingPoint.id
                                    },
                                    data: {
                                        points: existingPoint.points + pointsRequested,
                                        requestedBy: context.payload.comment.user.login,
                                    },
                                });
                            } else {
                                await prisma.pointAllocation.create({
                                    data: {
                                        points: pointsRequested,
                                        type,
                                        issueId: issue.id,
                                        requestedBy: context.payload.comment.user.login,
                                        allocatedTo,
                                    },
                                });
                            }

                            await checkAndHandlePointRevaluationNeededLabel(context);
                            await comment(
                                context,
                                commandSuccessWithMarkdown("Points requested"),
                            );
                            break;
                        case "revoke":
                            if (!checkIfCommenterIsAssignee(context) && !checkIfCommenterIsAdmin(context)) {
                                await comment(
                                    context,
                                    commandErrorWithMarkdown("Only admins or assignees can revoke"),
                                );
                                return;
                            }
                            if (!parts[3]) return;
                            const pointId = parts[3];
                            const existingPoint = await prisma.pointAllocation.findUnique({
                                where: {
                                    id: pointId.toString(),
                                },
                            });
                            if (!existingPoint) throw new Error("Invalid ID");

                            await prisma.pointAllocation.delete({
                                where: {
                                    id: pointId,
                                },
                            });

                            await checkAndHandlePointRevaluationNeededLabel(context);
                            await comment(
                                context,
                                commandSuccessWithMarkdown("Points revoked"),
                            );
                            break;
                        case "approve":
                            if (!checkIfCommenterIsAdmin(context)) {
                                await comment(
                                    context,
                                    commandErrorWithMarkdown("Only admins can approve"),
                                );
                                return;
                            }
                            if (!parts[3]) return;
                            const pointId = parts[3];
                            const existingPoint = await prisma.pointAllocation.findUnique({
                                where: {
                                    id: pointId.toString(),
                                },
                            });
                            await prisma.pointAllocation.update({
                                where: {
                                    id: existingPoint.id
                                },
                                data: {
                                    approvedAt: new Date(),
                                    approvedBy: context.payload.comment.user.login,
                                },
                            });
                            await checkAndHandlePointRevaluationNeededLabel(context);
                            await comment(
                                context,
                                commandSuccessWithMarkdown("Points approved"),
                            );
                            break;
                        case "reject":
                            if (!checkIfCommenterIsAdmin(context)) {
                                await comment(
                                    context,
                                    commandErrorWithMarkdown("Only admins can reject"),
                                );
                                return;
                            }
                            if (!parts[3]) return;
                            const pointId = parts[3];
                            const existingPoint = await prisma.pointAllocation.findUnique({
                                where: {
                                    id: pointId.toString(),
                                },
                            });
                            if (!existingPoint) throw new Error("Invalid ID");
                            await prisma.pointAllocation.delete({
                                where: {
                                    id: existingPoint.id,
                                },
                            });

                            await checkAndHandlePointRevaluationNeededLabel(context);
                            await comment(
                                context,
                                commandSuccessWithMarkdown("Points rejected"),
                            );
                            break;
                        case "list":
                            if (!checkIfCommenterIsAdmin(context)) {
                                await comment(
                                    context,
                                    commandErrorWithMarkdown("Only admins can list"),
                                );
                                return;
                            }
                            const pointAllocations = await prisma.pointAllocation.findMany({
                                where: {
                                    issueId: issue.id,
                                },
                            });
                            const table = `| Points | Type | Requested By | Allocated To | Approved By | Approved At |  Rejected By | Rejected At |
| --- | --- | --- | --- | --- | --- | --- | --- |
${pointAllocations
                                .map(
                                    (pa) =>
                                        `| ${pa.points} | ${pa.type} | ${pa.requestedBy} | ${pa.allocatedTo} | ${pa.approvedBy} | ${pa.approvedAt} | ${pa.rejectedBy} | ${pa.rejectedAt} |`,
                                )
                                .join("\n")}
`;
                            await comment(context, table);
                            break;
                        default:
                            await comment(
                                context,
                                commandErrorWithMarkdown(
                                    `Unknown command ${parts[2]}. Use /bot help to see available commands`,
                                ),
                            );
                            break;
                    }
                    await generateIssueOverview(context)
                    break;
                case "admin":
                    if (!checkIfCommenterIsAdmin(context)) return;
                    if (!parts[2]) return;
                    switch (parts[2]) {
                        case "re-create-labels":
                            await reCreateLabels(context);
                            await comment(
                                context,
                                commandSuccessWithMarkdown("Labels re-created"),
                            );
                            break;
                        case "re-create-issue":
                            // Delete issue if exists and re-create
                            await reCreateIssue(context as any);
                            await comment(
                                context,
                                commandSuccessWithMarkdown("Issue re-created"),
                            );
                            break;
                    }
                    break;
                default:
                    await comment(
                        context,
                        commandErrorWithMarkdown(
                            `Unknown command ${parts[1]}. Use /bot help to see available commands`,
                        ),
                    );
                    break;
                case "help":
                    await context.octokit.issues.createComment({
                        ...context.issue(),
                        body: `
          /bot assign <username> - Assigns issue to user
          /bot unassign <username> - Unassigns issue from user
          /bot label <label> - Adds label to issue
          /bot unlabel <label> - Removes label from issue
          /bot close - Closes issue
          /bot reopen - Reopens issue
          /bot comment <comment> - Adds comment to issue
          /bot admin re-create-labels - Re-creates labels [ ADMIN ONLY ]
          /bot admin re-create-issue - Re-creates issue [ ADMIN ONLY ]
          /bot help - Shows this help message
          /bot point allocate <points> - Allocates points to issue's assignee [ ADMIN ONLY ]
          /bot point request <user> <points> <type> - Requests points to a user
          /bot point revoke <pointID> - Revokes point request
          /bot point approve <pointID> - Approves point request [ ADMIN ONLY ]
          /bot point reject <points> - Rejects point request [ ADMIN ONLY ]
          /bot point list - Lists all point allocations
          
          /bot <command> -d - Deletes command comment
        `,
                    });
                    break;
            }
        } catch (e: any) {
            await comment(context, commandErrorWithMarkdown(e.message));
        }
        // await context.octokit.issues.createComment(issueComment);
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
