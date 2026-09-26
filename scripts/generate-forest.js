const fs = require("fs");
const path = require("path");

// ============================================================
// 1. 读取真实 GitHub contribution 数据
// ============================================================

const token = process.env.GH_PROFILE_TOKEN;

if (!token) {
  console.error("GH_PROFILE_TOKEN is missing.");
  process.exit(1);
}

const WEEKS = 53;
const DAYS = 7;

const LEVEL_MAP = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

function getDateRange() {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WEEKS * DAYS - 1));
  start.setUTCHours(0, 0, 0, 0);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

async function fetchContributionData() {
  const { from, to } = getDateRange();

  const query = `
    query($from: DateTime!, $to: DateTime!) {
      viewer {
        login
        contributionsCollection(from: $from, to: $to) {
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

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "qiqiqisi-contribution-forest",
    },
    body: JSON.stringify({
      query,
      variables: { from, to },
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("GitHub API request failed:");
    console.error(result);
    process.exit(1);
  }

  if (result.errors) {
    console.error("GraphQL errors:");
    console.error(result.errors);
    process.exit(1);
  }

  const viewer = result.data.viewer;
  const calendar =
    viewer.contributionsCollection.contributionCalendar;

  const weeks = calendar.weeks.slice(-WEEKS);

  const contributions = Array.from(
    { length: WEEKS },
    () => Array(DAYS).fill(0)
  );

  weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day, dayIndex) => {
      contributions[weekIndex][dayIndex] =
        LEVEL_MAP[day.contributionLevel] ?? 0;
    });
  });

  return {
    login: viewer.login,
    totalContributions: calendar.totalContributions,
    weeks,
    contributions,
  };
}

// ============================================================
// 2. SVG 基础参数
// ============================================================

const WIDTH = 930;
const HEIGHT = 430;

const ORIGIN_X = 120;
const ORIGIN_Y = 82;

const STEP_X = 12.3;
const STEP_Y = 6.2;

const TILE_W = 11.2;
const TILE_H = 5.6;

// ============================================================
// 3. SVG 工具函数
// ============================================================

function iso(week, day) {
  return [
    ORIGIN_X + (week - day) * STEP_X,
    ORIGIN_Y + (week + day) * STEP_Y,
  ];
}

function points(list) {
  return list.map(([x, y]) => `${x},${y}`).join(" ");
}

function polygon(list, fill, stroke = "none", strokeWidth = 0) {
  return `
    <polygon
      points="${points(list)}"
      fill="${fill}"
      stroke="${stroke}"
      stroke-width="${strokeWidth}"
    />
  `;
}

function rect(x, y, width, height, fill) {
  return `
    <rect
      x="${x}"
      y="${y}"
      width="${width}"
      height="${height}"
      fill="${fill}"
    />
  `;
}

// ============================================================
// 4. 立体树冠
// ============================================================

function prism(
  cx,
  cy,
  width,
  height,
  depth,
  topColor,
  sideColor
) {
  const top = [
    [cx, cy - height],
    [cx + width, cy - height + depth * 0.45],
    [cx, cy - height + depth * 0.9],
    [cx - width, cy - height + depth * 0.45],
  ];

  const left = [
    [cx - width, cy - height + depth * 0.45],
    [cx, cy - height + depth * 0.9],
    [cx, cy + depth * 0.9],
    [cx - width, cy + depth * 0.45],
  ];

  const right = [
    [cx + width, cy - height + depth * 0.45],
    [cx, cy - height + depth * 0.9],
    [cx, cy + depth * 0.9],
    [cx + width, cy + depth * 0.45],
  ];

  return `
    ${polygon(left, sideColor)}
    ${polygon(right, sideColor)}
    ${polygon(top, topColor)}
  `;
}

// ============================================================
// 5. 绘制树
//
// level 0：空地
// level 1：小草
// level 2：小树
// level 3：普通树
// level 4：高树
// ============================================================

function drawTree(x, y, level) {
  if (level === 0) {
    return "";
  }

  if (level === 1) {
    return `
      <g>
        ${polygon(
          [
            [x - 5.2, y + 1.8],
            [x - 2.5, y - 11],
            [x - 0.7, y + 1.8],
          ],
          "#dcefdc"
        )}

        ${polygon(
          [
            [x - 1.6, y + 1.8],
            [x + 0.1, y - 15],
            [x + 1.7, y + 1.8],
          ],
          "#a6dbab"
        )}

        ${polygon(
          [
            [x + 0.4, y + 1.8],
            [x + 4.6, y - 12],
            [x + 3.0, y + 1.8],
          ],
          "#bde3bf"
        )}

        ${polygon(
          [
            [x - 0.2, y + 1.8],
            [x + 2.0, y - 9],
            [x + 1.1, y + 1.8],
          ],
          "#82cd8f"
        )}
      </g>
    `;
  }

  const shadow = `
    <ellipse
      cx="${x}"
      cy="${y + 1}"
      rx="${5 + level * 1.2}"
      ry="${2 + level * 0.5}"
      fill="#1f2328"
      opacity="0.07"
    />
  `;

  if (level === 2) {
    return `
      <g>
        ${shadow}

        ${rect(
          x - 1.6,
          y - 18,
          3.2,
          18,
          "#806246"
        )}

        ${prism(
          x,
          y - 20,
          7,
          8,
          6,
          "#75c883",
          "#55ad69"
        )}
      </g>
    `;
  }

  if (level === 3) {
    return `
      <g>
        ${shadow}

        ${rect(
          x - 2,
          y - 27,
          4,
          27,
          "#7e6043"
        )}

        ${prism(
          x,
          y - 28,
          9,
          10,
          7,
          "#3da55a",
          "#2f8949"
        )}

        ${prism(
          x,
          y - 37,
          7,
          8,
          6,
          "#73c983",
          "#3e9859"
        )}
      </g>
    `;
  }

  return `
    <g>
      ${shadow}

      ${rect(
        x - 2.3,
        y - 38,
        4.6,
        38,
        "#75593e"
      )}

      ${prism(
        x,
        y - 30,
        11,
        12,
        8,
        "#176b39",
        "#12572e"
      )}

      ${prism(
        x,
        y - 41,
        9,
        11,
        7,
        "#2f9452",
        "#176d3c"
      )}

      ${prism(
        x,
        y - 50,
        6.5,
        8,
        5,
        "#55b96d",
        "#288246"
      )}
    </g>
  `;
}

// ============================================================
// 6. 地面
// ============================================================

function drawGround() {
  let svg = "";

  for (let week = 0; week < WEEKS; week++) {
    for (let day = 0; day < DAYS; day++) {
      const [x, y] = iso(week, day);

      const tile = [
        [x, y - TILE_H],
        [x + TILE_W, y],
        [x, y + TILE_H],
        [x - TILE_W, y],
      ];

      svg += polygon(
        tile,
        "#f4f6f4",
        "#e2e6e2",
        0.55
      );
    }
  }

  return svg;
}

// ============================================================
// 7. 森林
// ============================================================

function drawForest(contributions) {
  let svg = "";

  for (
    let sum = 0;
    sum < WEEKS + DAYS - 1;
    sum++
  ) {
    for (
      let day = DAYS - 1;
      day >= 0;
      day--
    ) {
      const week = sum - day;

      if (week < 0 || week >= WEEKS) {
        continue;
      }

      const level = contributions[week][day];

      if (level === 0) {
        continue;
      }

      const [x, y] = iso(week, day);

      const delay = (
        week * 0.035 +
        day * 0.015
      ).toFixed(2);

      const cls =
        level === 1 ? "grass-grow" : "tree-grow";

      svg += `
        <g
          class="${cls}"
          style="animation-delay: ${delay}s;"
        >
          ${drawTree(x, y, level)}
        </g>
      `;
    }
  }

  return svg;
}
// ============================================================
// 8. 月份标签（动态）
// ============================================================

function drawMonths(weeks) {
  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  const labels = [];
  const seen = new Set();

  if (weeks.length > 0 && weeks[0].contributionDays.length > 0) {
    const firstDate = new Date(
      `${weeks[0].contributionDays[0].date}T00:00:00Z`
    );
    const key = `${firstDate.getUTCFullYear()}-${firstDate.getUTCMonth()}`;
    seen.add(key);
    labels.push({
      week: 0,
      label: monthNames[firstDate.getUTCMonth()],
    });
  }

  weeks.forEach((week, weekIndex) => {
    for (const day of week.contributionDays) {
      const date = new Date(`${day.date}T00:00:00Z`);
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

      if (date.getUTCDate() === 1 && !seen.has(key)) {
        seen.add(key);
        labels.push({
          week: weekIndex,
          label: monthNames[date.getUTCMonth()],
        });
        break;
      }
    }
  });

  let svg = "";
  let lastX = -Infinity;

  labels.forEach(({ week, label }, index) => {
    const [x, y] = iso(week, 6);

    // 如果太近，就跳过，避免 sep / oct 这种撞在一起
    if (x - lastX < 38) {
      return;
    }

    lastX = x;

    svg += `
      <text
        class="month-label"
        x="${x + 2}"
        y="${y + 20}"
        fill="#5f6772"
        font-size="10.5"
        font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        text-anchor="middle"
      >
        ${label}
      </text>
    `;
  });

  return svg;
}

// ============================================================
// 9. 生成 SVG
// ============================================================

function buildSvg({
  login,
  totalContributions,
  weeks,
  contributions,
}) {
  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
  width="${WIDTH}"
  height="${HEIGHT}"
  role="img"
  aria-label="${login} GitHub contribution forest"
>
  <style>
    .title {
      opacity: 0;
      animation: fadeUp 0.65s ease forwards;
    }

    .subtitle {
      opacity: 0;
      animation: fadeUp 0.65s ease 0.22s forwards;
    }

    .meta-line {
      opacity: 0;
      animation: fadeUp 0.65s ease 0.55s forwards;
    }

    .month-label {
      opacity: 0;
      animation: fadeIn 0.35s ease 1.8s forwards;
    }

    .tree-grow {
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center bottom;
      animation: treeGrow 0.58s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }

    .grass-grow {
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center bottom;
      animation: grassGrow 0.42s ease-out forwards;
    }

    .blink {
      animation: blink 1s steps(1, end) infinite;
    }

    @keyframes fadeUp {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes treeGrow {
      0% {
        opacity: 0;
        transform: translateY(10px) scaleY(0.18) scaleX(0.9);
      }
      60% {
        opacity: 1;
      }
      100% {
        opacity: 1;
        transform: translateY(0) scaleY(1) scaleX(1);
      }
    }

    @keyframes grassGrow {
      0% {
        opacity: 0;
        transform: translateY(6px) scaleY(0.2);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scaleY(1);
      }
    }

    @keyframes blink {
      50% {
        opacity: 0;
      }
    }
  </style>

  <rect
    width="100%"
    height="100%"
    fill="#ffffff"
  />

  <text
    class="title"
    x="34"
    y="38"
    fill="#1f2328"
    font-size="16"
    font-weight="700"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    contribution forest<tspan class="blink">_</tspan>
  </text>

  <text
    class="subtitle"
    x="34"
    y="58"
    fill="#656d76"
    font-size="11"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    one year of activity, grown instead of counted.
  </text>

  ${drawGround()}

  ${drawForest(contributions)}

  ${drawMonths(weeks)}

  <text
    class="meta-line"
    x="34"
    y="385"
    fill="#55606d"
    font-size="10.5"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    total contributions in this view: ${totalContributions}
  </text>

  <text
    class="meta-line"
    x="34"
    y="402"
    fill="#8c959f"
    font-size="10"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    one year, 371 small chances to grow
  </text>

</svg>
`.trim();
}

// ============================================================
// 10. 写入 SVG
// ============================================================

async function main() {
  const data = await fetchContributionData();

  const svg = buildSvg(data);

  const outputDir = path.join(
    __dirname,
    "..",
    "assets"
  );

  fs.mkdirSync(outputDir, {
    recursive: true,
  });

  const outputPath = path.join(
    outputDir,
    "contribution-forest.svg"
  );

  fs.writeFileSync(outputPath, svg, "utf8");

  console.log(
    `✓ Contribution forest generated for ${data.login}`
  );
  console.log(
    `✓ Total contributions: ${data.totalContributions}`
  );
  console.log(`✓ Output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});