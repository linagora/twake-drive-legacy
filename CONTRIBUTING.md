# Contributing to Twake

Hey! Thank you for your interest in contributing to Twake, we really appreciate it.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

We are an open-source project and we love to receive contributions from our community! There are many ways to contribute - writing tutorials or blog posts, improving the documentation, submitting bug reports and feature requests, fixing bugs, submitting pull requests for enhancements, or reviewing other's pull requests.

## In a nutshell

- Notify us that you will work on something using the issues of github.
- Fork this repository to start working and create a new working branch on top of the develop branch preferably.
- To propose your changes, open a PR from your fork and target the **develop** branch.

## Ground Rules

Please adhere to the following responsibilities:

- Ensure cross-platform compatibility for every change that's accepted. For example, Windows, Mac, Debian & Ubuntu Linux.
- Any change must be done using **Pull Requests** incoming from a fork of original Twake repository.
- Create issues for any major changes and enhancements that you wish to make. Discuss things transparently and get community feedback.
- Don't add any classes to the codebase unless absolutely needed. Err on the side of using functions.
- Keep feature versions as small as possible, preferably one new feature per version.
- Be welcoming to newcomers and encourage diverse new contributions from all backgrounds. See the [Code of Conduct](https://github.com/linagora/Twake/blob/main/CODE_OF_CONDUCT.md)

#### What does the Code of Conduct mean for You?

Our [Code of Conduct](https://github.com/linagora/Twake/blob/main/CODE_OF_CONDUCT.md) means that you are responsible for treating everyone on the project with respect and courtesy regardless of their identity. If you are the victim of any inappropriate behavior or comments as described in our [Code of Conduct](https://github.com/linagora/Twake/blob/main/CODE_OF_CONDUCT.md), we are here for you. Please follow the guidelines on our [website](https://linagora.com/en/) to report the issue and we will do the best to ensure that the abuser is reprimanded appropriately per our code.

## Your First Contribution?

Unsure where to begin contributing to Twake? You can start by looking at these [good first issues](https://github.com/linagora/Twake/labels/good%20first%20issue) and [help wanted issues](https://github.com/linagora/Twake/labels/help%20wanted). Good first issues - issues which should require only a few lines of code, and a test or two. Help wanted issues - issues which should be a bit more involved than beginner issues. While not perfect, number of comments is a reasonable proxy for impact a given change will have.

Working on your first Pull Request? You can learn how from these free resources: [Course - How to Contribute to an Open Source Project on GitHub from @kentcdodds on @eggheadio](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github) and [Make a Pull Request](https://makeapullrequest.com/).

At this point, you are ready to make your changes! Feel free to ask for help; everyone is a beginner at first. 😃

If a maintainer asks you to "rebase" your PR, they are saying that a lot of code has changed, and that you need to update your branch so it's easier to merge.

## How to Contribute?

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

#### Pull Requests

**It's important to break your feature down into small pieces first,** each piece should become it's own pull request. Once you know, what the first small piece of your feature will be, follow this general process while working:

1. Create your own fork of the code and do changes in your own fork.

2. Make your first commit: any will do even if empty or trivial, but we need something in order to create the initial pull request. Create the pull request and use the [pull request naming convention](https://github.com/linagora/Twake/blob/main/Contribute/Commit%20%26%20Pull%20Request%20Title%20Format.md).

   - Make sure that the titles of your pull requests and commits respect this format - [Commit & Pull Request Format](https://github.com/linagora/Twake/blob/main/Contribute/Commit%20%26%20Pull%20Request%20Title%20Format.md)

   - Write a detailed description of the problem you are solving, the part of Twake it affects, and how you plan on fixing it.
   - If you have write access, add the **[Status] In Progress** label or wait until somebody adds it. This indicates that the pull request is not ready for a review and may still be incomplete. On the other hand, it welcomes early feedback and encourages collaboration during the development process.

3. Start developing and pushing out commits to your new branch.

   - Push your changes out frequently and try to avoid getting stuck in a long-running branch or a merge nightmare. Smaller changes are much easier to review and to deal with potential conflicts.
   - Note that you can automate some of these tasks by setting up githooks and they will run whenever you `git commit`.
   - Please feel free to change, [squash](http://gitready.com/advanced/2009/02/10/squashing-commits-with-rebase.html), and rearrange commits or to force push. Keep in mind, however, that if other people are committing on the same branch then you can mess up their history. You are perfectly safe if you are the only one pushing commits to that branch.
   - Squash minor commits such as typo fixes or fixes to previous commits in the pull request.

4. If you end up needing more than a few commits, consider splitting the pull request into separate components. Discuss in the new pull request and in the comments why the branch was broken apart and any changes that may have taken place that necessitated the split. Our goal is to catch early in the review process those pull requests that attempt to do too much.

5. When you feel that you are ready for a formal review or for merging into `trunk` make sure you check this list.

   - Make sure your branch merges cleanly and consider rebasing against `trunk` to keep the branch history short and clean. You must target the **develop** branch for your changes.
   - If there are visual changes, add before and after screenshots in the pull request comments.
   - Add unit tests, or at a minimum, provide helpful instructions for the reviewer so they can test your changes. This will help speed up the review process.
   - Ensure that your commit messages are [meaningful](https://thoughtbot.com/blog/5-useful-tips-for-a-better-commit-message).
   - Mention that the PR is ready for review or if you have write access remove the **[Status] In Progress** label from the pull request and add the **[Status] Needs Review** label - someone will provide feedback on the latest unreviewed changes. The reviewer will also mark the pull request as **[Status] Needs Author Reply** if they think you need to change anything.

6. If you get a :thumbsup: and the status has been changed to **[Status] Ready to Merge** - this is great - the pull request is ready to be merged.

If you feel yourself waiting for someone to review a PR, don't hesitate to personally ask for someone to review it or to mention them on Github. Remember, the PR author is responsible for pushing the change through.

#### Sign your work

We use the Developer Certificate of Origin (DCO) as an additional safeguard for the Linagora/Twake projects. This is a well established and widely used mechanism to assure contributors have confirmed their right to license their contributions under the project's license. Please read [Developer Certificate of Origin](https://github.com/linagora/Twake/blob/main/Contribute/Linagora%20Developer's%20Certificate%20of%20Origin.md). If you can certify it, then just add a line to every git commit message:

`Signed-Off by: Unicorn John <john.unicorn@jungle.org>`

Use your real name (sorry, no pseudonyms or anonymous contributions). If you set your `user.name` and `user.email` git configs, you can sign your commit automatically with `git commit-s`.

#### Code Reviews

Code Reviews are an important part of the Twake workflow. They help to keep code quality consistent, and they help every person working on Twake learn and improve over time. We want to make you the best Twake contributor you can be.

Every PR should be reviewed and approved by someone other than the author, even if the author has write access. Fresh eyes can find problems that can hide in the open if you have been working on the code for a while.

The recommended way of finding an appropriate person to review your code is by [blaming](https://docs.github.com/en/github/managing-files-in-a-repository/tracking-changes-in-a-file) one of the files you are updating and looking at who was responsible for previous commits on that file.

Then, you may ask that person to review your code by mentioning their Github username on the PR comments like this:

`cc @username`

_Everyone_ is encouraged to review PRs and add feedback and ask questions. Reading other people's code is a great way to learn new techniques, and seeing code outside of your own feature helps you to see patterns across the project. It's also helpful to see the feedback other contributors are getting on their PRs.

#### Apply a license

In case you are not sure about how to apply our license correctly, please have a look at [How to Apply Licence](https://github.com/linagora/Twake/blob/main/Contribute/HowtoApplyOurLicense.md).

#### How to report a bug?

If you find a security vulnerability, do NOT open an issue. Email schauhan@linagora.com instead.

In order to determine whether you are dealing with a security issue, ask yourself these two questions:

- Can I access something that's not mine, or something I should not have access to?

- Can I disable something for other people?

  If the answer to either of those two questions are "yes", then you are probably dealing with a security issue. Note that even if you answer "no" to both questions, you may still be dealing with a security issue, so if you're unsure, just email us at schauhan@linagora.com.

For reporting any other bug, just file [a Github issue.](https://github.com/linagora/Twake/issues/new/choose)

#### How to suggest a feature or enhancement?

If you find yourself wishing for a feature that doesn't exist in Twake, you are probably not alone. There are bound to be others out there with similar needs. Many of the features that Twake has today have been added because our users saw the need. Open an issues on our issues list on Github which describes the feature you would like to see, why you need it.

## Community

You can chat with the core team at [- Gitter](https://gitter.im/linagora/Twake) and we will try our best to reply to you as soon as possible.
