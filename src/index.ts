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
    },
    {
        issue_number: 117,
        repo: 'fused-frontend'
    }
]

const ongoing_issues = [
    {
        issue_number: 33,
        repo: 'fund-management'
    }
]

const repos = [
    'fund-management',
    'fused-frontend',
    'fused-backend',
    'fund-management-backend'
]

const developers = [
    'KrishEvoke',
    'Hasini-jayamali-m',
    'Keshara1997',
    'sahan-evoke',
    'LahiruC98',
    'MinjanaEvoke',
    'Chalithya',
    'MadusankaRuwan',
    'SanduniMP'
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

const adminUsers = ["Chathu94", "KrishEvoke", "KrishnaWanusha", "DasiniSumanaweera", "elroshanr"];

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

async function getAllPullRequests(context: Context) {
    let pullRequests = [];

    for await (const response of context.octokit.paginate.iterator(context.octokit.rest.pulls.list, {
        ...context.repo(),
        state: 'all',
        per_page: 100
    })) {
        pullRequests = pullRequests.concat(response.data);
    }

    return pullRequests;
}

const regenerateOverview = async (context: Context<"issues.assigned" | "issue_comment.created" | "issues.reopened">) => {
//     const previousWeekMonday = moment().subtract(1, 'weeks').startOf('isoWeek')
//     const latePreviousWeekMonday = moment().subtract(2, 'weeks').startOf('isoWeek')
//     const thisWeekMonday = moment().startOf('isoWeek')
//
//     const checkWeekBracket = (date: Date) => {
//         if (moment(date).isAfter(thisWeekMonday)) return 0
//         if (moment(date).isAfter(previousWeekMonday)) return 1
//         return 2
//     }
//
//     const pointsThisWeek = await prisma.pointAllocation.aggregateRaw({
//         pipeline: [
//             {
//                 $lookup: {
//                     from: 'Issue',
//                     localField: 'issueId',
//                     foreignField: '_id',
//                     as: 'issue'
//                 }
//             },
//             {
//                 $unwind: {
//                     path: '$issue'
//                 }
//             },
//             {
//                 $project: {
//                     _id: 1,
//                     issueId: 1,
//                     approvedAt: {$dateToString: {format: '%Y-%m-%dT%H:%M:%S.%LZ', date: '$approvedAt'}},
//                     approvedBy: 1,
//                     type: 1,
//                     createdAt: 1,
//                     updatedAt: 1,
//                     issue: 1,
//                     rejectedBy: 1,
//                     rejectedAt: 1,
//                     requestedBy: 1,
//                     allocatedTo: 1,
//                     points: 1
//                 }
//             }
//         ]
//     })
//
//     // const pointsThisWeek = await prisma.pointAllocation.findMany({
//     //
//     // })
//
//     const pointsByWeekAndAllocatedTo = pointsThisWeek?.filter(pa => !!pa.allocatedTo).reduce((a, pa) => {
//         const weekBracket = checkWeekBracket(pa.issue.closedAt ?? pa.approvedAt)
//         return ({
//             ...a,
//             [weekBracket]: {
//                 ...(a[weekBracket] ?? {}),
//                 [pa.allocatedTo]: {
//                     complete: pa.issue?.closed ? pa.points + (a[weekBracket]?.[pa.allocatedTo]?.complete ?? 0) : (a[weekBracket]?.[pa.allocatedTo]?.complete ?? 0),
//                     pending: !pa.issue?.closed ? pa.points + (a[weekBracket]?.[pa.allocatedTo]?.pending ?? 0) : (a[weekBracket]?.[pa.allocatedTo]?.pending ?? 0)
//                 }
//             }
//         })
//
//     }, {})
//     // Generate Week Table
//     const generateTable = (pointsByWeekAndAllocatedTo: any) => `| User | Pending Points | Complete Points
// | --- | --- | --- |
// ${Object.entries(pointsByWeekAndAllocatedTo ?? {}).map(([user, points]) => `| ${user} | ${points?.pending} | ${points?.complete} |`).join('\n')}
// `;
//     // Generate Current Week Table
//     const week0Table = generateTable(pointsByWeekAndAllocatedTo[0])
//     const week1Table = generateTable(pointsByWeekAndAllocatedTo[1])
//     const week2Table = generateTable(pointsByWeekAndAllocatedTo[2])
//
//     // Loop through issues and update overview
//     await Promise.all(overview_issues.map(async (issue) => {
//         const newOverviewComment = `<!--- bot-overview-week -->
//
// ## Current Week (${thisWeekMonday.format('DD/MM/YYYY')} - ${moment().endOf('isoWeek').format('DD/MM/YYYY')})
// ${week0Table}
// <!--- /bot-overview-week -->
//
// ## Previous Week (${previousWeekMonday.format('DD/MM/YYYY')} - ${moment().subtract(1, 'weeks').endOf('isoWeek').format('DD/MM/YYYY')})
// ${week1Table}
// <!--- /bot-overview-week -->
//
// ## Late Previous Week (${latePreviousWeekMonday.format('DD/MM/YYYY')} - ${moment().subtract(2, 'weeks').endOf('isoWeek').format('DD/MM/YYYY')})
// ${week2Table}
// <!--- /bot-overview-week -->`
//         await context.octokit.issues.update({
//             owner: 'evoke-labs',
//             issue_number: issue.issue_number,
//             repo: issue.repo,
//             body: newOverviewComment
//         })
//     }))
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

        const assigneeAllocation = pointAllocations.find((pa) => pa.type === "Assignee")
        const points = /^\[SP-(\d+)\].+/.exec(context.payload.issue.title)?.[1] ?? null
        if (assigneeAllocation && (!points || isNaN(parseInt(points)) || parseInt(points) !== assigneeAllocation.points)) {
            await context.octokit.issues.update({
                ...context.issue(),
                title: `[SP-${assigneeAllocation.points}] ${context.payload.issue.title.replace(/^\[SP-\d+\]/, '')}`
            })
        }

        const existingContent = context.payload.issue.body ?? '';
        const regex = /([\s\S]*?)<!---\s*bot-issue-overview\s*-->/;
        const match = existingContent.match(regex);
        const existingContentBeforeTable = match ? match[1] : '';

        return `${existingContentBeforeTable}<!--- bot-issue-overview -->
*Do not edit things below this line*
## Issue Overview (${issue.closed ? 'Closed' : 'Open'})
${issue.pr ? `PR: #${issue.pr} - ${moment(issue.prDate).format('DD-MMMM-YYYY hh:mm')}` : ''}
| ID | Points | Type | Requested By | Allocated To | Approved By | Approved At |
| --- | --- | --- | --- | --- | --- | --- |
${pointAllocations
            .map(
                (pa) =>
                    `| ${pa.id} | ${pa.points} | ${pa.type} | ${pa.requestedBy} | ${pa.allocatedTo} | ${pa.approvedBy} | ${moment(pa.approvedAt)?.format('DD-MMMM-YYYY hh:mm') ?? null} |`,
            )
            .join("\n")}`;
    }

    const table = await generateTable()
    await context.octokit.issues.update({
        ...context.issue(),
        body: table
    })
    await regenerateOverview(context)
}

const syncAllocatedToWithAssignee = async (context: Context<"issue_comment.created">) => {
    // if (!context.payload.issue.assignee) throw new Error("No one assigned for this issue");
    const issue = await prisma.issue.findUnique({
        where: {
            githubId: context.payload.issue.id,
        },
    });
    const pointAllocations = await prisma.pointAllocation.findMany({
        where: {
            issueId: issue.id
        }
    })
    const syncPoints = pointAllocations.filter(f => f.type !== 'Helper')
    if (syncPoints) {
        await prisma.pointAllocation.updateMany({
            where: {
                issueId: issue.id
            },
            data: {
                allocatedTo: context.payload.issue.assignee?.login ?? null
            }
        })
    }
    await regenerateOverview(context)
}

const isIssueClosed = (state: string) => {
    return state != 'open'
}

const syncIssue = async (context: Context<"issue_comment.created">) => {
    await prisma.issue.update({
        where: {
            githubId: context.payload.issue.id
        },
        data: {
            closed: isIssueClosed(context.payload.issue.state)
        }
    })
    await generateIssueOverview(context)
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
    if (!issue?.id) await reCreateIssue(context as any);
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
    if (!issue?.id) await reCreateIssue(context as any);

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

const getOpenIssuesByAssignee = async (context: Context<"issue_comment.created">, repo: string, assignee: string) => {
    try {
        const issues = await context.octokit.issues.listForRepo({
            owner: 'evoke-labs',
            repo: repo,
            assignee: assignee,
            state: 'open'
        })
        return issues.data.map((i) => ({
            number: i.number,
            title: i.title,
            url: i.html_url
        }))
    } catch (e: any) {
        console.error(e)
    }
}

const getAllIssuesForAssignees = async (context: Context<"issue_comment.created">) => {
    try {
        return await Promise.all(
            developers.map(async (assignee) => {
                const assingeeIssues = await Promise.all(
                    repos.map((repo) => getOpenIssuesByAssignee(context, repo, assignee))
                )
                return {
                    assignee,
                    issues: assingeeIssues.flat()
                }
            })
        );
    } catch (e: any) {
        console.error(e)
    }

}

const generateOngoingIssues = async (context: Context<"issue_comment.created">) => {
    try {
        const issuesByAllocatedTo = await getAllIssuesForAssignees(context)

        const generateTable = () => {
            return issuesByAllocatedTo.map((i) => {
                return `## ${i.assignee}
| **Open Issues** |
| --- |
${i.issues?.map(issue => `| [${issue.title.toString() || 'Null'}](${issue.url.toString()}) |`).join('\n')}`;
            })
                .join('\n');
        };

        await Promise.all(ongoing_issues.map(async (issue) => {
            await context.octokit.issues.update({
                owner: 'evoke-labs',
                issue_number: issue.issue_number,
                repo: issue.repo,
                body: generateTable()
            })
        }))

    } catch (e) {
        console.error(e)
    }
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
        if (!issue?.id) await reCreateIssue(context as any);
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
            await generateOngoingIssues(context)
        } catch (e: any) {
            await comment(context, commandErrorWithMarkdown(e.message));
        }
    });
    app.on("issues.unassigned", async (context) => {
        try {
            await handleAssignees(context)
            await generateOngoingIssues(context)
        } catch (e: any) {
            await comment(context, commandErrorWithMarkdown(e.message));
        }
    });
    app.on("issues.closed", async (context) => {
        try {
            const issue = await prisma.issue.findUnique({
                where: {
                    githubId: context.payload.issue.id,
                }
            })
            await prisma.issue.update({
                where: {
                    githubId: context.payload.issue.id
                },
                data: {
                    closed: true,
                    closedAt: !issue.closedAt ? new Date() : undefined
                }
            })
            await generateIssueOverview(context)
            await generateOngoingIssues(context)
        } catch (e: any) {
            await comment(context, commandErrorWithMarkdown(e.message));
        }
    });
    app.on("issues.reopened", async (context) => {
        try {
            await prisma.issue.update({
                where: {
                    githubId: context.payload.issue.id
                },
                data: {
                    closed: false
                }
            })
            await generateIssueOverview(context)
            await generateOngoingIssues(context)
        } catch (e: any) {
            await comment(context, commandErrorWithMarkdown(e.message));
        }
    });
    app.on("issues.deleted", async (context) => {
        try {
            const issue = await prisma.issue.findUnique({
                where: {
                    githubId: context.payload.issue.id
                }
            })

            if (issue) {
                await prisma.issue.delete({
                    where: {
                        id: issue.id
                    }
                })
                await regenerateOverview(context)
                await generateOngoingIssues(context)
            } else {
                throw new Error('Issue not found')
            }
        } catch (e) {
            console.error(e)
        }
    })
    app.on("issue_comment.created", async (context) => {
        if (context.isBot) return;
        // Check if comment is bot command
        const command = context.payload.comment.body;
        let parts = command.split(" ");
        if (parts.includes("-d")) {
            await context.octokit.issues.deleteComment({
                ...context.issue(),
                comment_id: context.payload.comment.id,
            });
            delete parts[parts.indexOf("-d")];
        }
        if (parts.length < 2 || parts[0] !== "/bot") return;
        try {
            if (parts.includes("-d")) {
                await context.octokit.issues.deleteComment({
                    ...context.issue(),
                    comment_id: context.payload.comment.id,
                });
            }
            switch (parts[1]) {
                case "test":
                    await generateOngoingIssues(context)
                    break;
                case "sync":
                    if (!parts[2]) return;
                    switch (parts[2]) {
                        case "issue":
                            await syncIssue(context)
                            break
                        case "assignee":
                            await syncAllocatedToWithAssignee(context)
                            break
                        default:
                            await comment(
                                context,
                                commandErrorWithMarkdown(
                                    `Unknown sync command. Available commands: [issue, assignee]`,
                                ),
                            )
                            break
                    }
                    break
                case "regenerate-overview":
                    await regenerateOverview(context)
                    break;
                case "assign":
                    const assignee = parts[2].startsWith("@")
                        ? parts[2].slice(1)
                        : parts[2];
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
                    if (!issue?.id) await reCreateIssue(context as any);
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
                            if (typeof points !== 'number' || points < 0 || isNaN(points))
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

                            if (!issue.prId) {
                                // Check if this issue is mentioned in a PR comments
                                const prComments = await getAllPullRequests(context)
                                const found = await Promise.all(prComments.map(async (pr) => {
                                    let found = pr?.body?.includes(`#${context.payload.issue.number}`)
                                    if (!found) {
                                        const comments = await context.octokit.issues.listComments({
                                            ...context.repo(),
                                            issue_number: pr.number
                                        })
                                        found = comments?.data?.find(c => c.body?.includes(`#${context.payload.issue.number}`))
                                    }
                                    return found ? [pr.number, pr.created_at, pr.updated_at] : undefined
                                }))
                                if (found?.filter(i => !!i)?.[0]) {
                                    const prId = found?.filter(i => !!i)?.[0][0]
                                    const created = found?.filter(i => !!i)?.[0][1]
                                    const updated = found?.filter(i => !!i)?.[0][2]
                                    await prisma.issue.update({
                                        where: {
                                            githubId: context.payload.issue.id
                                        },
                                        data: {
                                            pr: prId,
                                            prDate: new Date(updated ?? created)
                                        }
                                    })
                                }
                            } else {
                                // Update Date
                                const pr = await context.octokit.pulls.get({
                                    ...context.repo(),
                                    pull_number: issue.prId
                                })
                                const created = pr.data.created_at
                                const updated = pr.data.updated_at
                                await prisma.issue.update({
                                    where: {
                                        githubId: context.payload.issue.id
                                    },
                                    data: {
                                        prDate: new Date(updated ?? created)
                                    }
                                })
                            }

                            if (existingPoint) {
                                await prisma.pointAllocation.update({
                                    where: {
                                        id: existingPoint.id
                                    },
                                    data: {
                                        points: points,
                                        approvedAt: new Date(),
                                        allocatedTo: context.payload.issue.assignee ? context.payload.issue.assignee?.login : null,
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
                                        allocatedTo: context.payload.issue.assignee?.login ?? null,
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
