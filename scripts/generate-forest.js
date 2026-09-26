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

const WIDTH = 900;
const HEIGHT = 575;

const ORIGIN_X = 145;
const ORIGIN_Y = 105;

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
        0.55 +
        week * 0.026 +
        day * 0.012
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
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];

  const labels = [];
  const seen = new Set();

  weeks.forEach((week, weekIndex) => {
    for (const day of week.contributionDays) {
      const date = new Date(`${day.date}T00:00:00Z`);

      if (date.getUTCDate() !== 1) {
        continue;
      }

      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      labels.push({
        week: weekIndex,
        label: monthNames[date.getUTCMonth()],
      });
      break;
    }
  });

  return labels.map(({ week, label }, index) => {
    const [x, y] = iso(week, 6);
    const delay = (1.0 + index * 0.055).toFixed(2);

    return `
      <text
        class="month-label"
        style="animation-delay: ${delay}s"
        x="${x + 2}"
        y="${y + 20}"
        fill="#656d76"
        font-size="10.5"
        font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        text-anchor="middle"
      >
        ${label}
      </text>
    `;
  }).join("");
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
  <defs>
    <radialGradient id="softGlow" cx="67%" cy="24%" r="44%">
      <stop offset="0%" stop-color="#75c883" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <style>
    .card {
      opacity: 0;
      animation: cardIn .45s ease forwards;
    }

    .header-title,
    .header-caption,
    .legend,
    .sync-note {
      opacity: 0;
      transform: translateY(4px);
      animation: fadeUp .48s ease forwards;
    }

    .header-title { animation-delay: .12s; }
    .header-caption { animation-delay: .22s; }
    .legend { animation-delay: .28s; }
    .sync-note { animation-delay: .36s; }

    .ground {
      opacity: 0;
      animation: groundIn .55s ease .28s forwards;
    }

    .month-label {
      opacity: 0;
      animation: fadeIn .35s ease forwards;
    }

    .tree-grow,
    .grass-grow {
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center bottom;
    }

    .tree-grow {
      animation: treeGrow .54s cubic-bezier(.18,.78,.22,1) forwards;
    }

    .grass-grow {
      animation: grassGrow .40s ease-out forwards;
    }

    @keyframes cardIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes groundIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes treeGrow {
      0% {
        opacity: 0;
        transform: translateY(9px) scaleY(.18) scaleX(.92);
      }
      55% { opacity: 1; }
      100% {
        opacity: 1;
        transform: translateY(0) scaleY(1) scaleX(1);
      }
    }

    @keyframes grassGrow {
      from {
        opacity: 0;
        transform: translateY(5px) scaleY(.18);
      }
      to {
        opacity: 1;
        transform: translateY(0) scaleY(1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: .001ms !important;
        animation-delay: 0ms !important;
      }
    }
  </style>

  <rect
    class="card"
    x="1"
    y="1"
    width="${WIDTH - 2}"
    height="${HEIGHT - 2}"
    rx="16"
    fill="#ffffff"
    stroke="#d0d7de"
  />

  <rect
    class="card"
    x="1"
    y="1"
    width="${WIDTH - 2}"
    height="${HEIGHT - 2}"
    rx="16"
    fill="url(#softGlow)"
  />

  <text
    class="header-title"
    x="24"
    y="30"
    fill="#1f2328"
    font-size="15"
    font-weight="600"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    contribution forest
  </text>

  <text
    class="header-caption"
    x="24"
    y="50"
    fill="#656d76"
    font-size="11"
    font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
  >
    one year of activity, grown instead of counted.
  </text>

  <g class="legend" transform="translate(700 24)">
    <text x="0" y="9" fill="#656d76" font-size="10"
      font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">less</text>
    <rect x="29" y="1" width="9" height="9" rx="2" fill="#eef3ef"/>
    <rect x="43" y="1" width="9" height="9" rx="2" fill="#b7dfbd"/>
    <rect x="57" y="1" width="9" height="9" rx="2" fill="#75c883"/>
    <rect x="71" y="1" width="9" height="9" rx="2" fill="#3da55a"/>
    <rect x="85" y="1" width="9" height="9" rx="2" fill="#176b39"/>
    <text x="101" y="9" fill="#656d76" font-size="10"
      font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">more</text>
  </g>

  <text
    class="sync-note"
    x="676"
    y="50"
    fill="#8c959f"
    font-size="9.5"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    ${totalContributions} contributions · synced daily
  </text>

  <g class="ground">
    ${drawGround()}
  </g>

  ${drawForest(contributions)}
  ${drawMonths(weeks)}
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