/**
 * 更新状态类型定义
 */

export interface UpdateProgress {
    percent: number
    transferred: number
    total: number
    bytesPerSecond: number
}

export interface UpdateInfo {
    version: string
    releaseDate?: string
}

export interface UpdateError {
    message: string
}
