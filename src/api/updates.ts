export interface UpdateSettings {automaticCheck:boolean;intervalMinutes:number;notify:boolean;autoInstall:boolean;autoCore:boolean;autoPlugins:boolean}
export interface UpdateItem {id:string;name:string;kind:'core'|'web'|'plugin';installed:string;latest:string;available:boolean;enabled:boolean;blocked?:string;status?:string;phase?:string;error?:string}
export interface UpdateJob {id:string;status:string;items:UpdateItem[];startedAt:number;updatedAt:number;finishedAt?:number;error?:string;automatic:boolean}
export interface UpdateStatus {settings:UpdateSettings;items:UpdateItem[];lastCheckedAt:number|null;lastAttemptAt?:number;checking:boolean;error?:string;job?:UpdateJob}
