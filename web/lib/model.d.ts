/* model.js turlari (erkin) */
export const TPL: Record<string, any>;
export const DEF: Record<string, any>;
export const SIDE_NAMES: Record<string, string>;
export const SIDE_EDITORS: Record<string, [string, string][]>;
export function newProject(): any;
export function mkItem(key: string, p: any, qty?: number): any;
export function sanitize(o: any): any;
export function convertUnit(p: any, to: string): void;
export function setSideMode(it: any, mode: string): void;
export function regen(P: any): { PART: Map<string, any>; ERR: Map<string, string>; NEST: any; NEST_ERR: string | null };
export function san(s: string): string;
export function sheetName(P: any, name: string, sh: any): string;
export function sheetDXF(P: any, sh: any): string;
export function partName(name: string, it: any, pt: any): string;
export function partDXF(P: any, it: any, pt: any): string;
export function download(name: string, data: string | Blob, mime?: string): void;
export function checkedDownload(name: string, txt: string, extra?: string[], openOk?: boolean): void;
export function zipAll(P: any, name: string, R: any): Promise<string>;
