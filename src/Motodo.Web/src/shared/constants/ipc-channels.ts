// ═══════════════════════════════════════════
// IPC 频道名称常量
// 主进程与渲染进程通过 IPC 频道名称通信，统一定义避免拼写错误
// ═══════════════════════════════════════════

export const IPC_CHANNELS = {
    // 日历
    CALENDAR_LIST: 'calendar:list',
    CALENDAR_CREATE: 'calendar:create',
    CALENDAR_UPDATE: 'calendar:update',
    CALENDAR_REMOVE: 'calendar:remove',
    CALENDAR_TOGGLE_VISIBLE: 'calendar:toggle-visible',

    // 日程
    EVENT_QUERY: 'event:query',
    EVENT_GET_BY_ID: 'event:get-by-id',
    EVENT_CREATE: 'event:create',
    EVENT_UPDATE: 'event:update',
    EVENT_REMOVE: 'event:remove',
    EVENT_SEARCH: 'event:search',

    // 学期
    SEMESTER_LIST: 'semester:list',
    SEMESTER_GET_ACTIVE: 'semester:get-active',
    SEMESTER_CREATE: 'semester:create',
    SEMESTER_UPDATE: 'semester:update',
    SEMESTER_REMOVE: 'semester:remove',

    // 课程
    COURSE_LIST_BY_SEMESTER: 'course:list-by-semester',
    COURSE_CREATE: 'course:create',
    COURSE_UPDATE: 'course:update',
    COURSE_REMOVE: 'course:remove',

    // 提醒
    REMINDER_PENDING: 'reminder:pending',
    REMINDER_DISMISS: 'reminder:dismiss',
    REMINDER_SNOOZE: 'reminder:snooze',

    // 导出
    EXPORT_ICS: 'export:ics',
    EXPORT_JSON: 'export:json',
    EXPORT_IMPORT_ICS: 'export:import-ics',
    EXPORT_IMPORT_JSON: 'export:import-json',
    EXPORT_SELECT_FILE: 'export:select-file',
    EXPORT_SAVE_FILE: 'export:save-file',

    // 特殊日期
    SPECIAL_DATE_LIST: 'special-date:list',
    SPECIAL_DATE_CREATE: 'special-date:create',
    SPECIAL_DATE_REMOVE: 'special-date:remove',

    // 系统
    SYSTEM_APP_VERSION: 'system:app-version',
    SYSTEM_PLATFORM: 'system:platform',
    SYSTEM_SET_AUTO_START: 'system:set-auto-start',
    SYSTEM_IS_AUTO_START: 'system:is-auto-start',
    SYSTEM_OPEN_EXTERNAL: 'system:open-external',

    // 更新
    UPDATE_CHECK: 'update:check',
    UPDATE_DOWNLOAD: 'update:download',
    UPDATE_INSTALL: 'update:install'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
