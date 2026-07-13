-- ============================================================
-- SkillStack · V2 seed
-- ID 分配约定（确定性 ID，后续 BE agent 直接引用）：
--
--   categories: 1..7   (all/dev/data/design/doc/devops/ai)
--   users:      1..8   (lin_zr/zhao_yc/wu_jh/chen_yx/huang_t/sun_lw/pan_dq/mo_jr)
--   teams:      1..4   (ludou-fe/ludou-be/growth/design)
--   team_members:       ludou-fe 8 行 (id 1..8)
--   skills:     1..8   (mono-format..qa-snap)
--   suites:     1..4   (onboard/daily-fe/release-ops/open-source)
--   reviews:    1..4   (r-1042/r-1041/r-1039/r-1037)
--   invites_code:  1..4
--   invites_phone: 1..4
--   activity:   1..7
--
-- 密码统一用 bcrypt(password) -> $2a$10$EblZqNptyYvcLm/VwDCVAuBjzZOI1khDifqQjcyDuVrIeCQpD/qBC
-- ============================================================

SET NAMES utf8mb4;
SET @PW := '$2a$10$EblZqNptyYvcLm/VwDCVAuBjzZOI1khDifqQjcyDuVrIeCQpD/qBC';

-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
INSERT INTO categories (id, code, name, count, sort) VALUES
  (1, 'all',    '全部',    248, 0),
  (2, 'dev',    '开发工具', 86,  1),
  (3, 'data',   '数据处理', 54,  2),
  (4, 'design', '设计协作', 32,  3),
  (5, 'doc',    '文档生成', 28,  4),
  (6, 'devops', '运维',    24,  5),
  (7, 'ai',     'AI 增强', 24,  6);

-- ------------------------------------------------------------
-- users (TEAM_MEMBERS 8 人，明文密码 password)
-- ------------------------------------------------------------
INSERT INTO users (id, handle, name, email, phone, avatar, password_hash, joined_at) VALUES
  (1, 'lin_zr',  '林子睿', 'lin.zr@ludou.test',  '13800000001', '林', @PW, '2023-08-12 09:00:00'),
  (2, 'zhao_yc', '赵一辰', 'zhao.yc@ludou.test', '13800002046', '赵', @PW, '2023-09-04 09:00:00'),
  (3, 'wu_jh',   '吴嘉禾', 'wu.jh@ludou.test',   '13800000003', '吴', @PW, '2023-11-21 09:00:00'),
  (4, 'chen_yx', '陈奕笑', 'chen.yx@ludou.test', '13800000004', '陈', @PW, '2024-01-08 09:00:00'),
  (5, 'huang_t', '黄  桃', 'huang.t@ludou.test', '13800000005', '黄', @PW, '2024-03-17 09:00:00'),
  (6, 'sun_lw',  '孙临舞', 'sun.lw@ludou.test',  '13800000006', '孙', @PW, '2024-05-02 09:00:00'),
  (7, 'pan_dq',  '潘鼎清', 'pan.dq@ludou.test',  '13800000007', '潘', @PW, '2024-09-14 09:00:00'),
  (8, 'mo_jr',   '莫俊然', 'mo.jr@ludou.test',   '13800000008', '莫', @PW, '2025-01-22 09:00:00');

-- ------------------------------------------------------------
-- teams (MY_TEAMS 4 个，ludou-fe 同时也是 TEAM 主团队)
-- ------------------------------------------------------------
INSERT INTO teams (id, slug, name, description, avatar_char, color, members_count, public_skills, private_skills, suites_count) VALUES
  (1, 'ludou-fe', '麓豆前端组', '负责麓豆产品线的前端基础建设、组件库与开发者工具。对内沉淀工程化 Skill，对外开源通用能力。', '麓', '#4F46E5', 18, 14, 9, 4),
  (2, 'ludou-be', '麓豆后端组', '麓豆服务端基础设施与中间件团队。', '麓', '#0EA5E9', 22, 8, 12, 2),
  (3, 'growth',   '增长数据小组', '面向增长场景的数据分析与实验平台。', '增', '#10B981', 9, 5, 4, 1),
  (4, 'design',   '产品设计组',  '负责品牌、视觉与产品交互。', '设', '#F59E0B', 6, 2, 1, 0);

-- ------------------------------------------------------------
-- team_members: ludou-fe 8 人，handle/role/joined/skills/last_active 对齐 data.jsx
-- ------------------------------------------------------------
INSERT INTO team_members (id, team_id, user_id, role, skills_count, joined_at, last_active_at, last_active_label) VALUES
  (1, 1, 1, 'OWNER',  12, '2023-08-12 09:00:00', NOW(),                          '2 分钟前'),
  (2, 1, 2, 'ADMIN',   9, '2023-09-04 09:00:00', NOW(),                          '刚刚'),
  (3, 1, 3, 'ADMIN',   7, '2023-11-21 09:00:00', DATE_SUB(NOW(), INTERVAL 1 HOUR),'1 小时前'),
  (4, 1, 4, 'MEMBER',  4, '2024-01-08 09:00:00', DATE_FORMAT(NOW(), '%Y-%m-%d 10:24:00'), '今天 10:24'),
  (5, 1, 5, 'MEMBER',  3, '2024-03-17 09:00:00', DATE_SUB(NOW(), INTERVAL 1 DAY), '昨天'),
  (6, 1, 6, 'MEMBER',  2, '2024-05-02 09:00:00', DATE_SUB(NOW(), INTERVAL 3 DAY), '3 天前'),
  (7, 1, 7, 'MEMBER',  1, '2024-09-14 09:00:00', DATE_SUB(NOW(), INTERVAL 1 DAY), '昨天'),
  (8, 1, 8, 'MEMBER',  0, '2025-01-22 09:00:00', DATE_SUB(NOW(), INTERVAL 7 DAY), '7 天前');

-- 另外把当前用户 zhao_yc(id=2) 也挂到另外 3 个团队 (MY_TEAMS 模拟)
INSERT INTO team_members (team_id, user_id, role, skills_count, joined_at, last_active_label) VALUES
  (2, 2, 'MEMBER', 0, '2024-02-01 09:00:00', '1 天前'),
  (3, 2, 'MEMBER', 0, '2024-06-01 09:00:00', '昨天'),
  (4, 2, 'VIEWER', 0, '2024-09-01 09:00:00', '上周');

-- ------------------------------------------------------------
-- user_team_unread (MY_TEAMS.unread)
-- ------------------------------------------------------------
INSERT INTO user_team_unread (user_id, team_id, unread) VALUES
  (2, 1, 3),
  (2, 2, 0),
  (2, 3, 1),
  (2, 4, 0);

-- ------------------------------------------------------------
-- skills (8 条，team_id=1 ludou-fe)
-- ------------------------------------------------------------
INSERT INTO skills (id, slug, name, short_desc, cat_code, icon, version, visibility, status, author_id, team_id, installs, stars, score, safety, eval_score, langs, published_at) VALUES
  (1, 'mono-format',    'Skill A · mono-format',  '统一的多语言代码格式化命令，封装 prettier / black / gofmt。', 'dev',    'A', '2.4.1', 'PUBLIC',       'APPROVED', 1, 1, 12480, 824, 4.80, 'pass', 92, JSON_ARRAY('TS','Py','Go'), '2026-05-12 10:00:00'),
  (2, 'api-mock',       'Skill B · api-mock',     '基于 OpenAPI 文档的本地 Mock 服务，零配置启动。',           'dev',    'B', '1.8.3', 'PUBLIC',       'APPROVED', 2, 1,  9820, 612, 4.70, 'pass', 88, JSON_ARRAY('TS'),         '2026-05-09 10:00:00'),
  (3, 'sql-tidy',       'Skill C · sql-tidy',     '高性能 SQL 美化与重写，支持 MySQL / Postgres 方言。',        'data',   'C', '0.9.2', 'PUBLIC',       'APPROVED', 3, 1,  7640, 458, 4.60, 'pass', 85, JSON_ARRAY('SQL'),        '2026-05-04 10:00:00'),
  (4, 'env-doctor',     'Skill D · env-doctor',   '一键诊断本地开发环境，覆盖 Node / Python / Java / Docker。', 'devops', 'D', '1.2.0', 'PUBLIC',       'APPROVED', 4, 1,  6210, 391, 4.50, 'pass', 80, JSON_ARRAY('Sh'),         '2026-04-28 10:00:00'),
  (5, 'i18n-extract',   'Skill E · i18n-extract', '从 React / Vue 源码自动提取文案并生成 i18n 资源文件。',     'dev',    'E', '3.0.0', 'PUBLIC',       'APPROVED', 1, 1,  5180, 304, 4.40, 'pass', 78, JSON_ARRAY('TS'),         '2026-04-22 10:00:00'),
  (6, 'doc-gen',        'Skill F · doc-gen',      '根据接口注释生成 Markdown 文档站点。',                       'doc',    'F', '2.1.0', 'PUBLIC',       'APPROVED', 2, 1,  4720, 268, 4.30, 'warn', 72, JSON_ARRAY('TS'),         '2026-04-18 10:00:00'),
  (7, 'ludou-release',  'Skill · ludou-release',  '麓豆内部统一发布流程脚本，包含 changelog、tag、灰度脚本。',  'devops', 'L', '4.6.2', 'TEAM_PRIVATE', 'APPROVED', 3, 1,   320,   0, 0.00, 'pass', 90, JSON_ARRAY('Sh'),         '2026-05-15 10:00:00'),
  (8, 'qa-snap',        'Skill · qa-snap',        '为内部业务页生成视觉回归基线，与 CI 集成。',                 'devops', 'Q', '0.5.1', 'TEAM_PRIVATE', 'APPROVED', 4, 1,   180,   0, 0.00, 'pass', 76, JSON_ARRAY('TS'),         '2026-05-11 10:00:00');

-- skill_versions: 每个 skill 至少有当前版本一条记录
INSERT INTO skill_versions (skill_id, version, changelog, files_count, safety, eval_score, published_at) VALUES
  (1, '2.4.1', '初始 seed 版本', 8, 'pass', 92, '2026-05-12 10:00:00'),
  (2, '1.8.3', '初始 seed 版本', 6, 'pass', 88, '2026-05-09 10:00:00'),
  (3, '0.9.2', '初始 seed 版本', 5, 'pass', 85, '2026-05-04 10:00:00'),
  (4, '1.2.0', '初始 seed 版本', 7, 'pass', 80, '2026-04-28 10:00:00'),
  (5, '3.0.0', '初始 seed 版本', 9, 'pass', 78, '2026-04-22 10:00:00'),
  (6, '2.1.0', '初始 seed 版本', 4, 'warn', 72, '2026-04-18 10:00:00'),
  (7, '4.6.2', '初始 seed 版本', 12,'pass', 90, '2026-05-15 10:00:00'),
  (8, '0.5.1', '初始 seed 版本', 3, 'pass', 76, '2026-05-11 10:00:00');

-- ------------------------------------------------------------
-- tags + skill_tags
-- ------------------------------------------------------------
INSERT INTO tags (id, name) VALUES
  (1, 'CLI'), (2, 'formatter'), (3, 'monorepo'),
  (4, 'mock'), (5, 'OpenAPI'),
  (6, 'SQL'), (7, 'lint'),
  (8, 'diagnostic'),
  (9, 'i18n'), (10, 'AST'),
  (11, 'docs'), (12, 'mdx'),
  (13, '内部'), (14, 'release'),
  (15, 'visual');

INSERT INTO skill_tags (skill_id, tag_id) VALUES
  (1, 1), (1, 2), (1, 3),
  (2, 4), (2, 5),
  (3, 6), (3, 7),
  (4, 1), (4, 8),
  (5, 9), (5, 10),
  (6, 11), (6, 12),
  (7, 13), (7, 14),
  (8, 13), (8, 15);

-- ------------------------------------------------------------
-- suites (4 个，team_id=1)
-- ------------------------------------------------------------
INSERT INTO suites (id, slug, name, description, team_id, visibility, installs, skills_count) VALUES
  (1, 'onboard',     '新人上手套件', '新成员入组第一周需要安装的工具集。',            1, 'TEAM_PRIVATE',   24, 6),
  (2, 'daily-fe',    '前端日常开发', '本地开发、调试、Mock、格式化、Lint 一键就绪。', 1, 'TEAM_PRIVATE',   42, 8),
  (3, 'release-ops', '发布与运维',   '从打 tag、changelog 到灰度脚本的发布闭环。',     1, 'TEAM_PRIVATE',   11, 4),
  (4, 'open-source', '麓豆开源精选', '团队对外开源的核心 Skill,推荐组合安装。',       1, 'PUBLIC',       1820, 5);

-- suite_items: s2 = SUITE_SELECTED 6 项
INSERT INTO suite_items (suite_id, skill_id, position) VALUES
  (2, 1, 1),  -- mono-format
  (2, 2, 2),  -- api-mock
  (2, 4, 3),  -- env-doctor
  (2, 5, 4),  -- i18n-extract
  (2, 6, 5),  -- doc-gen
  -- lint-bundle 暂无对应 skill 行，留待后续 review 通过后补建。先填一个常用替代：sql-tidy
  (2, 3, 6);

-- 其它 suite 给出最小 seed
INSERT INTO suite_items (suite_id, skill_id, position) VALUES
  (1, 4, 1), (1, 1, 2), (1, 2, 3),  -- onboard
  (3, 7, 1), (3, 8, 2),              -- release-ops
  (4, 1, 1), (4, 2, 2), (4, 5, 3), (4, 6, 4); -- open-source

-- ------------------------------------------------------------
-- reviews (4 条, REVIEWS)
-- ------------------------------------------------------------
INSERT INTO reviews (id, code, skill_id, skill_slug, skill_name, short_desc, team_id, submitter_id, visibility, files_count, version, safety, eval_score, status, reason, submitted_at) VALUES
  (1, 'r-1042', NULL, 'graphql-codegen', 'Skill · graphql-codegen', '根据 schema.graphql 自动生成前端 hooks 与类型。',           1, 4, 'TEAM_PRIVATE', 12, '0.1.0', 'pass', 81, 'PENDING_REVIEW', NULL, DATE_FORMAT(NOW(), '%Y-%m-%d 09:14:00')),
  (2, 'r-1041', NULL, 'lint-bundle',     'Skill · lint-bundle',     '麓豆前端统一 ESLint + Stylelint 规则集合。',                 1, 5, 'PUBLIC',        4, '1.0.0', 'pass', 88, 'PENDING_REVIEW', NULL, DATE_FORMAT(NOW(), '%Y-%m-%d 08:02:00')),
  (3, 'r-1039', NULL, 'release-notes',   'Skill · release-notes',   '从 Git commit 自动整理 release notes。',                     1, 7, 'PUBLIC',        6, '0.3.2', 'warn', 64, 'PENDING_REVIEW', NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (4, 'r-1037', NULL, 'mock-cookies',    'Skill · mock-cookies',    '调试用临时 Cookie / Session 注入器。',                       1, 6, 'PUBLIC',        3, '0.1.0', 'fail', 41, 'REJECTED',       '包含直接读取浏览器 Cookie 的代码,未做权限说明,请补充安全声明后重新提交。', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- ------------------------------------------------------------
-- invites_code (4 条)
-- ------------------------------------------------------------
INSERT INTO invites_code (id, team_id, code, max_uses, used, role, expires_at, expires_label, created_by, status) VALUES
  (1, 1, 'LD-FE-7K3M',       10, 3, 'MEMBER', DATE_ADD(NOW(), INTERVAL 14 DAY), '14 天', 1, 'active'),
  (2, 1, 'LD-FE-INTERN-26',  20, 12,'MEMBER', DATE_ADD(NOW(), INTERVAL 7 DAY),  '7 天',  2, 'active'),
  (3, 1, 'LD-FE-LEAD-Q2',    3,  1, 'ADMIN',  DATE_ADD(NOW(), INTERVAL 30 DAY), '30 天', 1, 'active'),
  (4, 1, 'LD-FE-OLD-X1',     8,  8, 'MEMBER', DATE_ADD(NOW(), INTERVAL 30 DAY), '已用完', 1, 'exhausted');

-- ------------------------------------------------------------
-- invites_phone (4 条)
-- ------------------------------------------------------------
INSERT INTO invites_phone (id, team_id, phone_masked, phone_raw, invited_by, note, status, at_label, created_at) VALUES
  (1, 1, '138****4421', '13800004421', 1, '后端组借调',         'pending',  '2 小时前', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
  (2, 1, '139****1098', '13900001098', 2, '新入职 / 周五入组',  'pending',  '昨天',     DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (3, 1, '137****7732', '13700007732', 2, '',                   'accepted', '3 天前',   DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (4, 1, '186****0021', '18600000021', 1, '设计协作',           'declined', '5 天前',   DATE_SUB(NOW(), INTERVAL 5 DAY));

-- ------------------------------------------------------------
-- activity (7 条, ACTIVITY)
-- ------------------------------------------------------------
INSERT INTO activity (id, team_id, actor_id, kind, target, target_skill_id, target_suite_id, extra, when_label, created_at) VALUES
  (1, 1, 1, 'approve', 'lint-bundle',             NULL, NULL, NULL,       '12 分钟前', DATE_SUB(NOW(), INTERVAL 12 MINUTE)),
  (2, 1, 4, 'submit',  'graphql-codegen',         NULL, NULL, NULL,       '32 分钟前', DATE_SUB(NOW(), INTERVAL 32 MINUTE)),
  (3, 1, 2, 'invite',  '邀请了 3 位手机号成员',    NULL, NULL, NULL,       '1 小时前',  DATE_SUB(NOW(), INTERVAL 1 HOUR)),
  (4, 1, 3, 'release', 'ludou-release@4.6.2',     7,    NULL, NULL,       '今天 09:00', DATE_FORMAT(NOW(), '%Y-%m-%d 09:00:00')),
  (5, 1, 1, 'unlist',  'qa-snap',                 8,    NULL, '设为下架', '昨天 17:21', DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 17:21:00'), INTERVAL 1 DAY)),
  (6, 1, 5, 'join',    '',                        NULL, NULL, NULL,       '昨天 14:02', DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d 14:02:00'), INTERVAL 1 DAY)),
  (7, 1, 2, 'suite',   '前端日常开发',             NULL, 2,    NULL,       '2 天前',    DATE_SUB(NOW(), INTERVAL 2 DAY));
