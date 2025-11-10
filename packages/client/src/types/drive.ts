import type * as Misskey from "calckey-js";

export type VirtualDriveFolderKind =
        | "yearMonthRoot"
        | "yearMonth"
        | "fileTypeRoot"
        | "fileType";

export interface VirtualDriveFolder {
        id: string;
        name: string;
        parentId: string | null;
        parent: Misskey.entities.DriveFolder | VirtualDriveFolder | null;
        isVirtual: true;
        kind: VirtualDriveFolderKind;
        query?: {
                type?: string | null;
                fromDate?: string;
                untilDate?: string;
        };
        meta?: {
                year?: number;
                month?: number;
                count?: number;
                majorType?: string;
        };
}

export type DriveFolderLike = Misskey.entities.DriveFolder | VirtualDriveFolder;

export function isVirtualDriveFolder(
        folder: DriveFolderLike | null | undefined,
): folder is VirtualDriveFolder {
        return Boolean(folder && (folder as VirtualDriveFolder).isVirtual);
}
