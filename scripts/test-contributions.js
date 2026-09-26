const token = process.env.GH_PROFILE_TOKEN;

if (!token) {
  console.error("GH_PROFILE_TOKEN is missing.");
  process.exit(1);
}

const query = `
query {
  viewer {
    login

    contributionsCollection {
      hasAnyRestrictedContributions

      contributionCalendar {
        totalContributions

        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
            weekday
          }
        }
      }
    }
  }
}
`;

async function main() {
  const response = await fetch(
    "https://api.github.com/graphql",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "qiqiqisi-contribution-forest",
      },

      body: JSON.stringify({
        query,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error(
      `GitHub API request failed: ${response.status}`
    );

    console.error(result);

    process.exit(1);
  }

  if (result.errors) {
    console.error("GraphQL errors:");
    console.error(result.errors);

    process.exit(1);
  }

  const viewer = result.data.viewer;

  const collection =
    viewer.contributionsCollection;

  const calendar =
    collection.contributionCalendar;

  const days =
    calendar.weeks.flatMap(
      (week) => week.contributionDays
    );

  console.log(
    `Authenticated as: ${viewer.login}`
  );

  console.log(
    `Total contributions: ${calendar.totalContributions}`
  );

  console.log(
    `Contains private/restricted contributions: ${collection.hasAnyRestrictedContributions}`
  );

  console.log(
    `Days returned: ${days.length}`
  );

  console.log("\nLast 7 days:");

  days
    .slice(-7)
    .forEach((day) => {
      console.log(
        `${day.date} | count=${day.contributionCount} | level=${day.contributionLevel}`
      );
    });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});