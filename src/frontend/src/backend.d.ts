import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface DuplicateGroup {
    winner: KeywordEntry;
    duplicates: Array<KeywordEntry>;
    keyword: string;
}
export interface KeywordEntry {
    id: bigint;
    frequency: bigint;
    keyword: string;
}
export interface backendInterface {
    addEntries(newEntries: Array<[string, bigint]>): Promise<Array<bigint>>;
    addEntry(keyword: string, frequency: bigint): Promise<bigint>;
    analyzeDuplicates(): Promise<Array<DuplicateGroup>>;
    cleanDuplicates(): Promise<void>;
    clearAll(): Promise<void>;
    deleteEntry(id: bigint): Promise<void>;
    getAllEntries(): Promise<Array<KeywordEntry>>;
}
