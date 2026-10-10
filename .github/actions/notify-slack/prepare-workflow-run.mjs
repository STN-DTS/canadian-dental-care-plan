/**
 * @file Retrieves failed jobs for the originating workflow run attempt.
 * Paginated GitHub API failures warn and omit details without blocking delivery.
 * Exports job-results JSON only; authentication credentials are never exported.
 */
import fs from "node:fs";

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const run = event.workflow_run;
let results = {};

if (event.action === "completed" && run.conclusion !== "success") {
  try {
    const jobs = [];
    for (let page = 1; ; page++) {
      const url = new URL(
        `${process.env.API_URL}/repos/${process.env.REPOSITORY}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`,
      );
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Job metadata unavailable");
      const data = await response.json();
      jobs.push(...data.jobs);
      if (data.jobs.length < 100) break;
    }
    results = Object.fromEntries(
      jobs
        .filter((job) => ["failure", "timed_out", "startup_failure"].includes(job.conclusion))
        .map((job) => [job.name, { result: "failure" }]),
    );
  } catch {
    console.log(
      "::warning::Unable to fetch failed jobs; posting the workflow result without job details.",
    );
  }
}

fs.appendFileSync(process.env.GITHUB_OUTPUT, `job-results=${JSON.stringify(results)}\n`);
