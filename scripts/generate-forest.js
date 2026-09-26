const fs = require("fs");
const path = require("path");

// ============================================================
// 1. 当前先使用模拟 contribution 数据
//    下一阶段再把这里替换成你的真实 GitHub contribution
// ============================================================

const WEEKS = 53;
const DAYS = 7;

function seededRandom(seed) {
  let x = seed >>> 0;

  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const random = seededRandom(20260926);

function createMockContributions() {
  const result = [];

  for (let week = 0; week < WEEKS; week++) {
    result[week] = [];

    // 故意制造几段“活跃期”，让预览森林有高低起伏
    const seasonal =
      0.34 +
      0.22 * Math.sin((week / 52) * Math.PI * 3 - 0.7);

    const cluster =
      (week > 13 && week < 20 ? 0.24 : 0) +
      (week > 34 && week < 42 ? 0.3 : 0) +
      (week > 45 && week < 50 ? 0.16 : 0);

    for (let day = 0; day < DAYS; day++) {
      const weekendPenalty =
        day === 0 || day === 6 ? -0.1 : 0.03;

      const score =
        random() +
        seasonal +
        cluster +
        weekendPenalty;

      let level = 0;

      if (score > 1.24) level = 4;
      else if (score > 1.03) level = 3;
      else if (score > 0.83) level = 2;
      else if (score > 0.68) level = 1;

      result[week][day] = level;
    }
  }

  return result;
}

const contributions = createMockContributions();


// ============================================================
// 2. SVG 基础参数
// ============================================================

const WIDTH = 1100;
const HEIGHT = 540;

// 等距投影视角
const ORIGIN_X = 180;
const ORIGIN_Y = 95;

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
// 4. 绘制等距立体树冠
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
// 5. 不同 contribution 等级对应不同树
//
// level 0：空地
// level 1：小芽
// level 2：小树
// level 3：普通树
// level 4：高树
// ============================================================

function drawTree(x, y, level) {
  if (level === 0) {
    return "";
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
// 6. 绘制地面
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
// 7. 绘制森林
//
// 注意按“从后向前”的顺序绘制，
// 否则 SVG 会出现前后遮挡错误。
// ============================================================

function drawForest() {
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

      const [x, y] = iso(week, day);

      svg += drawTree(
        x,
        y,
        contributions[week][day]
      );
    }
  }

  return svg;
}


// ============================================================
// 8. 月份标签
// ============================================================

function drawMonths() {
  const monthNames = [
    "oct",
    "nov",
    "dec",
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
  ];

  const monthWeeks = [
    0,
    4,
    9,
    13,
    18,
    22,
    26,
    31,
    35,
    40,
    44,
    48,
  ];

  let svg = "";

  monthNames.forEach((month, index) => {
    const [x, y] = iso(
      monthWeeks[index],
      6
    );

    svg += `
      <text
        x="${x + 2}"
        y="${y + 24}"
        fill="#656d76"
        font-size="10.5"
        font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        text-anchor="middle"
      >
        ${month}
      </text>
    `;
  });

  return svg;
}


// ============================================================
// 9. 最终 SVG
// ============================================================

const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 ${WIDTH} ${HEIGHT}"
  width="${WIDTH}"
  height="${HEIGHT}"
  role="img"
  aria-label="qiqiqisi GitHub contribution forest"
>

  <rect
    width="100%"
    height="100%"
    fill="#ffffff"
  />

  <text
    x="34"
    y="38"
    fill="#1f2328"
    font-size="16"
    font-weight="600"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    contribution forest
  </text>

  <text
    x="34"
    y="58"
    fill="#656d76"
    font-size="11"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    one year of activity, grown instead of counted.
  </text>

  ${drawGround()}

  ${drawForest()}

  ${drawMonths()}

  <text
    x="34"
    y="510"
    fill="#8c959f"
    font-size="10"
    font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  >
    one year, 365 small chances to grow
  </text>

</svg>
`;


// ============================================================
// 10. 写入 assets/contribution-forest.svg
// ============================================================

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

fs.writeFileSync(
  outputPath,
  svg.trim(),
  "utf8"
);

console.log(
  `✓ Contribution forest generated:
${outputPath}`
);