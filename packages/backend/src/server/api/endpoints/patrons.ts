import define from "../define.js";
import { redisClient } from "@/db/redis.js";
import fetch from 'node-fetch';

export const meta = {
  tags: ["meta"],
  description: "Get repository statistics",
  requireCredential: false,
  requireCredentialPrivateMode: false,
} as const;

export const paramDef = {
  type: "object",
  properties: {
    forceUpdate: { type: "boolean", default: false }
  },
  required: [],
} as const;
interface Author {
  name: string;
  email: string;
  date: string; // 最終コミット日時
}

interface Committer {
  name: string;
  email: string;
  date: string; // 最終コミット日時
}

interface Tree {
  sha: string;
  url: string;
}

interface Verification {
  verified: boolean;
  reason: string;
  signature: string | null;
  payload: string | null;
}

interface Commit {
  author: Author;
  committer: Committer;
  message: string;
  tree: Tree;
  url: string;
  comment_count: number;
  verification: Verification;
}

interface User {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
}

interface Parent {
  sha: string;
  url: string;
  html_url: string;
}

interface CommitData {
  sha: string;
  node_id: string;
  commit: Commit;
  url: string;
  html_url: string;
  comments_url: string;
  author: User;
  committer: User;
  parents: Parent[];
}

export default define(meta, paramDef, async (ps) => {
  const { forceUpdate } = ps;
  const owner = "emtkmkk";
  const repo = "mkkey";

  const cacheKey = `repo-stats:${owner}:${repo}`;
  let repoStats;

  const cachedStats = await redisClient.get(cacheKey);
  if (!forceUpdate && cachedStats) {
    repoStats = JSON.parse(cachedStats);
  } else {
    try {
      const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;
      const statsUrl = `https://api.github.com/repos/${owner}/${repo}/stats/contributors`;
      const participationUrl = `https://api.github.com/repos/${owner}/${repo}/stats/participation`;

      const [commitsResponse, statsResponse, participationResponse] = await Promise.all([
        fetch(commitsUrl),
        fetch(statsUrl),
        fetch(participationUrl)
      ]);

      if (!commitsResponse.ok || !statsResponse.ok || !participationResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const commitsData = await commitsResponse.json() as CommitData[];
      const statsData = await statsResponse.json();
      const participationData = await participationResponse.json() as {owner: number[]};

      const latestCommit = commitsData[0];
      const userStats = statsData.find(contributor => contributor.author.login === owner);

      if (!userStats) {
        throw new Error('User not found in repository stats');
      }

      const totalCommits = userStats.total;
      const yearlyCommits = participationData.owner.reduce((sum, weekCommits) => sum + weekCommits, 0);
      const monthlyCommits = participationData.owner.slice(-4).reduce((sum, weekCommits) => sum + weekCommits, 0);

      repoStats = {
        commitCount: totalCommits,
        lastCommitDate: latestCommit.commit.author.date,
        yearlyCommits: yearlyCommits,
				monthlyCommits: monthlyCommits,
      };

      await redisClient.set(cacheKey, JSON.stringify(repoStats), "EX", 3600);
    } catch (error) {
      if (cachedStats) {
        repoStats = JSON.parse(cachedStats);
      } else {
        repoStats = {
          commitCount: 0,
          lastCommitDate: null,
          yearlyCommits: 0,
					monthlyCommits: 0,
        };
      }
    }
  }

  return {
		patron: [],
		sponsors: [],
    commitCount: repoStats.commitCount,
    lastCommitDate: repoStats.lastCommitDate,
    yearlyCommits: repoStats.yearlyCommits,
    monthlyCommits: repoStats.monthlyCommits,
  };
});
