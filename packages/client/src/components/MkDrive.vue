<template>
	<div class="yfudmmck">
		<nav>
			<div class="path" @contextmenu.prevent.stop="() => {}">
				<XNavFolder
					:class="{ current: folder == null }"
					:parent-folder="folder"
					@move="move"
					@upload="upload"
					@removeFile="removeFile"
					@removeFolder="removeFolder"
				/>
				<template v-for="f in hierarchyFolders">
					<span class="separator"
						><i class="ph-caret-right ph-bold ph-lg"></i
					></span>
					<XNavFolder
						:folder="f"
						:parent-folder="folder"
						@move="move"
						@upload="upload"
						@removeFile="removeFile"
						@removeFolder="removeFolder"
					/>
				</template>
				<span v-if="folder != null" class="separator"
					><i class="ph-caret-right ph-bold ph-lg"></i
				></span>
				<span v-if="folder != null" class="folder current">{{
					folder.name
				}}</span>
			</div>
			<button class="menu _button" @click="showMenu">
				<i class="ph-dots-three-outline ph-bold ph-lg"></i>
			</button>
		</nav>
		<div
			ref="main"
			class="main"
			:class="{ uploading: uploadings.length > 0, fetching }"
			@dragover.prevent.stop="onDragover"
			@dragenter="onDragenter"
			@dragleave="onDragleave"
			@drop.prevent.stop="onDrop"
			@contextmenu.stop="onContextmenu"
		>
			<div ref="contents" class="contents">
				<div
					v-show="folders.length > 0"
					ref="foldersContainer"
					class="folders"
				>
					<XFolder
						v-for="(f, i) in folders"
						:key="f.id"
						v-anim="i"
						class="folder"
						:folder="f"
						:select-mode="select === 'folder'"
						:is-selected="
							selectedFolders.some((x) => x.id === f.id)
						"
						@chosen="chooseFolder"
						@move="move"
						@upload="upload"
						@removeFile="removeFile"
						@removeFolder="removeFolder"
						@dragstart="isDragSource = true"
						@dragend="isDragSource = false"
					/>
					<!-- SEE: https://stackoverflow.com/questions/18744164/flex-box-align-last-row-to-grid -->
					<div v-for="(n, i) in 16" :key="i" class="padding"></div>
					<MkButton v-if="moreFolders" ref="moreFolders">{{
						i18n.ts.loadMore
					}}</MkButton>
				</div>
				<div
					v-show="files.length > 0"
					ref="filesContainer"
					class="files"
				>
					<XFile
						v-for="(file, i) in files"
						:key="file.id"
						v-anim="i"
						class="file"
						:file="file"
						:select-mode="select === 'file'"
						:is-selected="
							selectedFiles.some((x) => x.id === file.id)
						"
						@chosen="chooseFile"
						@dragstart="isDragSource = true"
						@dragend="isDragSource = false"
					/>
					<!-- SEE: https://stackoverflow.com/questions/18744164/flex-box-align-last-row-to-grid -->
					<div v-for="(n, i) in 16" :key="i" class="padding"></div>
					<MkButton
						v-show="moreFiles"
						ref="loadMoreFiles"
						@click="fetchMoreFiles"
						>{{ i18n.ts.loadMore }}</MkButton
					>
				</div>
				<div
					v-if="files.length == 0 && folders.length == 0 && !fetching"
					class="empty"
				>
					<p v-if="draghover">{{ i18n.t("empty-draghover") }}</p>
					<p v-if="!draghover && folder == null">
						<strong>{{ i18n.ts.emptyDrive }}</strong
						><br />{{ i18n.t("empty-drive-description") }}
					</p>
					<p v-if="!draghover && folder != null">
						{{ i18n.ts.emptyFolder }}
					</p>
				</div>
			</div>
			<MkLoading v-if="fetching" />
		</div>
		<div v-if="draghover" class="dropzone"></div>
		<input
			ref="fileInput"
			type="file"
			accept="*/*"
			multiple
			tabindex="-1"
			@change="onChangeFileInput"
		/>
	</div>
</template>

<script lang="ts" setup>
import {
	markRaw,
	nextTick,
	onActivated,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from "vue";
import * as Misskey from "calckey-js";
import MkButton from "./MkButton.vue";
import XNavFolder from "@/components/MkDrive.navFolder.vue";
import XFolder from "@/components/MkDrive.folder.vue";
import XFile from "@/components/MkDrive.file.vue";
import * as os from "@/os";
import { stream } from "@/stream";
import { defaultStore } from "@/store";
import { i18n } from "@/i18n";
import { uploadFile, uploads } from "@/scripts/upload";
import {
        isVirtualDriveFolder,
        type DriveFolderLike,
        type VirtualDriveFolder,
} from "@/types/drive";

const props = withDefaults(
	defineProps<{
		initialFolder?: Misskey.entities.DriveFolder;
		type?: string;
		multiple?: boolean;
		select?: "file" | "folder" | null;
	}>(),
	{
		multiple: false,
		select: null,
	}
);

const emit = defineEmits<{
	(
		ev: "selected",
		v: Misskey.entities.DriveFile | Misskey.entities.DriveFolder
	): void;
	(
		ev: "change-selection",
		v: Misskey.entities.DriveFile[] | Misskey.entities.DriveFolder[]
	): void;
	(ev: "move-root"): void;
	(ev: "cd", v: Misskey.entities.DriveFolder | null): void;
	(ev: "open-folder", v: Misskey.entities.DriveFolder): void;
}>();

const loadMoreFiles = ref<InstanceType<typeof MkButton>>();
const fileInput = ref<HTMLInputElement>();

const folder = ref<DriveFolderLike | null>(null);
const files = ref<Misskey.entities.DriveFile[]>([]);
const folders = ref<DriveFolderLike[]>([]);
const moreFiles = ref(false);
const moreFolders = ref(false);
const hierarchyFolders = ref<DriveFolderLike[]>([]);
const selectedFiles = ref<Misskey.entities.DriveFile[]>([]);
const selectedFolders = ref<Misskey.entities.DriveFolder[]>([]);
const uploadings = uploads;
const connection = stream.useChannel("drive");
const keepOriginal = ref<boolean>(defaultStore.state.keepOriginalUploading); // 外部渡しが多いので$refは使わないほうがよい
const keepFileName = ref<boolean>(defaultStore.state.keepFileName); // 外部渡しが多いので$refは使わないほうがよい

// ドロップされようとしているか
const draghover = ref(false);

// 自身の所有するアイテムがドラッグをスタートさせたか
// (自分自身の階層にドロップできないようにするためのフラグ)
const isDragSource = ref(false);

const fetching = ref(true);

type AutoFoldersData = {
        months: {
                year: number;
                month: number;
                from: string;
                until: string;
                count: number;
        }[];
        types: {
                majorType: string;
                type: string | null;
                count: number;
        }[];
};

const autoFoldersCache = ref<{
        typeKey: string | null;
        data: AutoFoldersData;
} | null>(null);

const ilFilesObserver = new IntersectionObserver(
        (entries) =>
                entries.some((entry) => entry.isIntersecting) &&
                !fetching.value &&
                moreFiles.value &&
                fetchMoreFiles()
);

watch(folder, () =>
        emit(
                "cd",
                isVirtualDriveFolder(folder.value)
                        ? null
                        : (folder.value as Misskey.entities.DriveFolder | null),
        ),
);

watch(
        () => props.type,
        () => {
                autoFoldersCache.value = null;
                if (isVirtualDriveFolder(folder.value) || folder.value == null) {
                        fetch();
                }
        },
);

const AUTO_YEAR_MONTH_ROOT_ID = "virtual:year-month-root";
const AUTO_FILE_TYPE_ROOT_ID = "virtual:file-type-root";

function autoFoldersCacheKey(): string | null {
        return props.type ?? null;
}

async function getAutoFoldersData(): Promise<AutoFoldersData> {
        const key = autoFoldersCacheKey();
        if (autoFoldersCache.value?.typeKey !== key) {
                const response = (await os.api("drive/auto-folders", {
                        type: props.type ?? undefined,
                })) as AutoFoldersData;
                autoFoldersCache.value = {
                        typeKey: key,
                        data: {
                                months: response.months ?? [],
                                types: response.types ?? [],
                        },
                };
        }
        return autoFoldersCache.value.data;
}

function invalidateAutoFolders() {
        autoFoldersCache.value = null;
}

function formatYearMonthLabel(year: number, month: number): string {
        const paddedMonth = month.toString().padStart(2, "0");
        return i18n.t("driveYearMonthLabel", {
                year,
                month: paddedMonth,
        });
}

function getFileTypeLabel(majorType: string): string {
        switch (majorType) {
                case "image":
                        return i18n.ts.driveFileTypeImage;
                case "video":
                        return i18n.ts.driveFileTypeVideo;
                case "audio":
                        return i18n.ts.driveFileTypeAudio;
                case "text":
                        return i18n.ts.driveFileTypeText;
                case "application":
                        return i18n.ts.driveFileTypeApplication;
                case "model":
                        return i18n.ts.driveFileTypeModel;
                default:
                        return i18n.t("driveFileTypeOther", { type: majorType });
        }
}

function createYearMonthRootFolder(): VirtualDriveFolder {
        return {
                id: AUTO_YEAR_MONTH_ROOT_ID,
                name: i18n.ts.driveAutoFolderByYearMonth,
                parentId: null,
                parent: null,
                isVirtual: true,
                kind: "yearMonthRoot",
        };
}

function createYearMonthFolder(
        entry: AutoFoldersData["months"][number],
        parent: VirtualDriveFolder,
): VirtualDriveFolder {
        return {
                id: `${AUTO_YEAR_MONTH_ROOT_ID}:${entry.year}-${entry.month}`,
                name: formatYearMonthLabel(entry.year, entry.month),
                parentId: parent.id,
                parent,
                isVirtual: true,
                kind: "yearMonth",
                query: {
                        fromDate: entry.from,
                        untilDate: entry.until,
                },
                meta: {
                        year: entry.year,
                        month: entry.month,
                        count: entry.count,
                },
        };
}

function createFileTypeRootFolder(): VirtualDriveFolder {
        return {
                id: AUTO_FILE_TYPE_ROOT_ID,
                name: i18n.ts.driveAutoFolderByType,
                parentId: null,
                parent: null,
                isVirtual: true,
                kind: "fileTypeRoot",
        };
}

function createFileTypeFolder(
        entry: AutoFoldersData["types"][number],
        parent: VirtualDriveFolder,
): VirtualDriveFolder {
        return {
                id: `${AUTO_FILE_TYPE_ROOT_ID}:${entry.majorType}`,
                name: getFileTypeLabel(entry.majorType),
                parentId: parent.id,
                parent,
                isVirtual: true,
                kind: "fileType",
                query: {
                        type: entry.type,
                },
                meta: {
                        majorType: entry.majorType,
                        count: entry.count,
                },
        };
}

function buildHierarchyFrom(folderToDive: DriveFolderLike | null) {
        const stack: DriveFolderLike[] = [];
        let pointer = folderToDive?.parent ?? null;
        while (pointer) {
                stack.unshift(pointer);
                pointer = pointer.parent ?? null;
        }
        hierarchyFolders.value = stack;
}

function matchesTypeFilter(
        filter: string | null | undefined,
        fileType: string | null | undefined,
): boolean {
        if (!filter) return true;
        if (!fileType) return false;
        if (filter.endsWith("/*")) {
                return fileType.startsWith(filter.replace("/*", "/"));
        }
        return fileType === filter;
}

function matchesCurrentFolder(file: Misskey.entities.DriveFile): boolean {
        const baseTypeFilter = props.type;

        if (!folder.value) {
                return file.folderId == null && matchesTypeFilter(baseTypeFilter, file.type);
        }

        if (isVirtualDriveFolder(folder.value)) {
                const query = folder.value.query ?? {};
                const effectiveType = query.type ?? baseTypeFilter;

                if (!matchesTypeFilter(effectiveType, file.type)) return false;

                if (query.fromDate) {
                        const from = new Date(query.fromDate);
                        const createdAt = new Date(file.createdAt);
                        if (Number.isFinite(from.valueOf()) && createdAt < from) return false;
                }

                if (query.untilDate) {
                        const until = new Date(query.untilDate);
                        const createdAt = new Date(file.createdAt);
                        if (Number.isFinite(until.valueOf()) && createdAt >= until) return false;
                }

                return true;
        }

        return (
                folder.value.id === file.folderId &&
                matchesTypeFilter(baseTypeFilter, file.type)
        );
}

function refreshVirtualStructureIfNeeded() {
        if (
                isVirtualDriveFolder(folder.value) &&
                (folder.value.kind === "yearMonthRoot" || folder.value.kind === "fileTypeRoot")
        ) {
                fetch();
        }
}

function onStreamDriveFileCreated(file: Misskey.entities.DriveFile) {
        invalidateAutoFolders();
        addFile(file, true);
        refreshVirtualStructureIfNeeded();
}

function onStreamDriveFileUpdated(file: Misskey.entities.DriveFile) {
        invalidateAutoFolders();
        if (!matchesCurrentFolder(file)) {
                removeFile(file);
        } else {
                addFile(file, true);
        }
        refreshVirtualStructureIfNeeded();
}

function onStreamDriveFileDeleted(fileId: string) {
        invalidateAutoFolders();
        removeFile(fileId);
        refreshVirtualStructureIfNeeded();
}

function onStreamDriveFolderCreated(
        createdFolder: Misskey.entities.DriveFolder
) {
        if (isVirtualDriveFolder(folder.value)) return;
        addFolder(createdFolder, true);
}

function onStreamDriveFolderUpdated(
        updatedFolder: Misskey.entities.DriveFolder
) {
        if (isVirtualDriveFolder(folder.value)) return;
        const current = folder.value ? folder.value.id : null;
        if (current !== updatedFolder.parentId) {
                removeFolder(updatedFolder);
        } else {
                addFolder(updatedFolder, true);
        }
}

function onStreamDriveFolderDeleted(folderId: string) {
        if (isVirtualDriveFolder(folder.value)) return;
        removeFolder(folderId);
}

function onDragover(ev: DragEvent): any {
	if (!ev.dataTransfer) return;

	// ドラッグ元が自分自身の所有するアイテムだったら
	if (isDragSource.value) {
		// 自分自身にはドロップさせない
		ev.dataTransfer.dropEffect = "none";
		return;
	}

	const isFile = ev.dataTransfer.items[0].kind === "file";
	const isDriveFile = ev.dataTransfer.types[0] === _DATA_TRANSFER_DRIVE_FILE_;
	const isDriveFolder =
		ev.dataTransfer.types[0] === _DATA_TRANSFER_DRIVE_FOLDER_;
	if (isFile || isDriveFile || isDriveFolder) {
		ev.dataTransfer.dropEffect =
			ev.dataTransfer.effectAllowed === "all" ? "copy" : "move";
	} else {
		ev.dataTransfer.dropEffect = "none";
	}

	return false;
}

function onDragenter() {
	if (!isDragSource.value) draghover.value = true;
}

function onDragleave() {
	draghover.value = false;
}

function onDrop(ev: DragEvent): any {
        draghover.value = false;

        if (!ev.dataTransfer) return;

        const targetFolderId =
                !isVirtualDriveFolder(folder.value) && folder.value
                        ? folder.value.id
                        : null;

        // ドロップされてきたものがファイルだったら
        if (ev.dataTransfer.files.length > 0) {
                for (const file of Array.from(ev.dataTransfer.files)) {
                        upload(file, folder.value);
		}
		return;
	}

	//#region ドライブのファイル
        const driveFile = ev.dataTransfer.getData(_DATA_TRANSFER_DRIVE_FILE_);
        if (driveFile != null && driveFile !== "") {
                if (isVirtualDriveFolder(folder.value)) {
                        return;
                }
                const file = JSON.parse(driveFile);
                if (files.value.some((f) => f.id === file.id)) return;
                removeFile(file.id);
                os.api("drive/files/update", {
                        fileId: file.id,
                        folderId: targetFolderId,
                });
        }
        //#endregion

        //#region ドライブのフォルダ
        const driveFolder = ev.dataTransfer.getData(_DATA_TRANSFER_DRIVE_FOLDER_);
        if (driveFolder != null && driveFolder !== "") {
                if (isVirtualDriveFolder(folder.value)) {
                        return;
                }
                const droppedFolder = JSON.parse(driveFolder);

                // 移動先が自分自身ならreject
                if (folder.value && droppedFolder.id === folder.value.id) return false;
                if (folders.value.some((f) => f.id === droppedFolder.id)) return false;
                removeFolder(droppedFolder.id);
                os.api("drive/folders/update", {
                        folderId: droppedFolder.id,
                        parentId: targetFolderId,
                })
			.then(() => {
				// noop
			})
			.catch((err) => {
				switch (err) {
					case "detected-circular-definition":
						os.alert({
							title: i18n.ts.unableToProcess,
							text: i18n.ts.circularReferenceFolder,
						});
						break;
					default:
						os.alert({
							type: "error",
							text: i18n.ts.somethingHappened,
						});
				}
			});
	}
	//#endregion
}

function selectLocalFile() {
	fileInput.value?.click();
}

function urlUpload() {
        os.inputText({
                title: i18n.ts.uploadFromUrl,
                type: "url",
                placeholder: i18n.ts.uploadFromUrlDescription,
        }).then(({ canceled, result: url }) => {
                if (canceled || !url) return;
                os.api("drive/files/upload-from-url", {
                        url: url,
                        folderId:
                                !isVirtualDriveFolder(folder.value) && folder.value
                                        ? folder.value.id
                                        : undefined,
                });

                os.alert({
                        title: i18n.ts.uploadFromUrlRequested,
                        text: i18n.ts.uploadFromUrlMayTakeTime,
		});
	});
}

function createFolder() {
        os.inputText({
                title: i18n.ts.createFolder,
                placeholder: i18n.ts.folderName,
        }).then(({ canceled, result: name }) => {
                if (canceled) return;
                os.api("drive/folders/create", {
                        name: name,
                        parentId:
                                !isVirtualDriveFolder(folder.value) && folder.value
                                        ? folder.value.id
                                        : undefined,
                }).then((createdFolder) => {
                        addFolder(createdFolder, true);
                });
        });
}

function renameFolder(folderToRename: Misskey.entities.DriveFolder) {
	os.inputText({
		title: i18n.ts.renameFolder,
		placeholder: i18n.ts.inputNewFolderName,
		default: folderToRename.name,
	}).then(({ canceled, result: name }) => {
		if (canceled) return;
		os.api("drive/folders/update", {
			folderId: folderToRename.id,
			name: name,
		}).then((updatedFolder) => {
			// FIXME: 画面を更新するために自分自身に移動
			move(updatedFolder);
		});
	});
}

function deleteFolder(folderToDelete: Misskey.entities.DriveFolder) {
	os.api("drive/folders/delete", {
		folderId: folderToDelete.id,
	})
		.then(() => {
			// 削除時に親フォルダに移動
			move(folderToDelete.parentId);
		})
		.catch((err) => {
			switch (err.id) {
				case "b0fc8a17-963c-405d-bfbc-859a487295e1":
					os.alert({
						type: "error",
						title: i18n.ts.unableToDelete,
						text: i18n.ts.hasChildFilesOrFolders,
					});
					break;
				default:
					os.alert({
						type: "error",
						text: i18n.ts.unableToDelete,
					});
			}
		});
}

function onChangeFileInput() {
	if (!fileInput.value?.files) return;
	for (const file of Array.from(fileInput.value.files)) {
		upload(file, folder.value);
	}
}

function upload(file: File, folderToUpload?: DriveFolderLike | null) {
        const targetFolderId =
                folderToUpload && !isVirtualDriveFolder(folderToUpload)
                        ? folderToUpload.id
                        : null;
        uploadFile(
                file,
                targetFolderId,
                undefined,
                keepOriginal.value,
                keepFileName.value
        ).then((res) => {
                addFile(res, true);
	});
}

function chooseFile(file: Misskey.entities.DriveFile) {
	const isAlreadySelected = selectedFiles.value.some((f) => f.id === file.id);
	if (props.multiple) {
		if (isAlreadySelected) {
			selectedFiles.value = selectedFiles.value.filter(
				(f) => f.id !== file.id
			);
		} else {
			selectedFiles.value.push(file);
		}
		emit("change-selection", selectedFiles.value);
	} else {
		if (isAlreadySelected) {
			emit("selected", file);
		} else {
			selectedFiles.value = [file];
			emit("change-selection", [file]);
		}
	}
}

function chooseFolder(folderToChoose: DriveFolderLike) {
        if (isVirtualDriveFolder(folderToChoose)) return;
        const isAlreadySelected = selectedFolders.value.some(
                (f) => f.id === folderToChoose.id
        );
        if (props.multiple) {
                if (isAlreadySelected) {
			selectedFolders.value = selectedFolders.value.filter(
				(f) => f.id !== folderToChoose.id
			);
		} else {
			selectedFolders.value.push(folderToChoose);
		}
		emit("change-selection", selectedFolders.value);
	} else {
		if (isAlreadySelected) {
			emit("selected", folderToChoose);
		} else {
			selectedFolders.value = [folderToChoose];
			emit("change-selection", [folderToChoose]);
		}
	}
}

function move(target?: DriveFolderLike | string) {
        if (!target) {
                goRoot();
                return;
        }

        if (typeof target === "object") {
                if (isVirtualDriveFolder(target)) {
                        folder.value = target;
                        buildHierarchyFrom(target);
                        fetch();
                        return;
                }
                target = target.id;
        }

        fetching.value = true;

        os.api("drive/folders/show", {
                folderId: target,
        }).then((folderToMove) => {
                folder.value = folderToMove;
                buildHierarchyFrom(folderToMove);

                emit("open-folder", folderToMove);
                fetch();
        });
}

function addFolder(folderToAdd: DriveFolderLike, unshift = false) {
        if (isVirtualDriveFolder(folderToAdd)) return;
        if (isVirtualDriveFolder(folder.value)) return;

        const current = folder.value ? folder.value.id : null;
        if (current !== folderToAdd.parentId) return;

        if (folders.value.some((f) => f.id === folderToAdd.id)) {
                const exist = folders.value.map((f) => f.id).indexOf(folderToAdd.id);
                folders.value[exist] = folderToAdd;
                return;
	}

	if (unshift) {
		folders.value.unshift(folderToAdd);
	} else {
		folders.value.push(folderToAdd);
	}
}

function addFile(fileToAdd: Misskey.entities.DriveFile, unshift = false) {
        if (!matchesCurrentFolder(fileToAdd)) return;

        if (files.value.some((f) => f.id === fileToAdd.id)) {
                const exist = files.value.map((f) => f.id).indexOf(fileToAdd.id);
                files.value[exist] = fileToAdd;
                return;
	}

	if (unshift) {
		files.value.unshift(fileToAdd);
	} else {
		files.value.push(fileToAdd);
	}
}

function removeFolder(folderToRemove: Misskey.entities.DriveFolder | string) {
	const folderIdToRemove =
		typeof folderToRemove === "object" ? folderToRemove.id : folderToRemove;
	folders.value = folders.value.filter((f) => f.id !== folderIdToRemove);
}

function removeFile(file: Misskey.entities.DriveFile | string) {
	const fileId = typeof file === "object" ? file.id : file;
	files.value = files.value.filter((f) => f.id !== fileId);
}

function appendFile(file: Misskey.entities.DriveFile) {
	addFile(file);
}

function appendFolder(folderToAppend: DriveFolderLike) {
        addFolder(folderToAppend);
}
/*
function prependFile(file: Misskey.entities.DriveFile) {
	addFile(file, true);
}

function prependFolder(folderToPrepend: Misskey.entities.DriveFolder) {
	addFolder(folderToPrepend, true);
}
*/
function goRoot() {
        // 既にrootにいるなら何もしない
        if (folder.value == null) return;

        folder.value = null;
        buildHierarchyFrom(null);
        emit("move-root");
        fetch();
}

async function fetch() {
        folders.value = [];
        files.value = [];
        moreFolders.value = false;
        moreFiles.value = false;
        fetching.value = true;

        const foldersMax = 30;
        const filesMax = 30;

        if (
                isVirtualDriveFolder(folder.value) &&
                (folder.value.kind === "yearMonthRoot" || folder.value.kind === "fileTypeRoot")
        ) {
                try {
                        const autoData = await getAutoFoldersData();
                        const current = folder.value;
                        const entries =
                                current.kind === "yearMonthRoot"
                                        ? autoData.months.map((entry) =>
                                                createYearMonthFolder(entry, current),
                                          )
                                        : autoData.types.map((entry) =>
                                                createFileTypeFolder(entry, current),
                                          );
                        folders.value = entries;
                } finally {
                        fetching.value = false;
                }
                return;
        }

        const isVirtual = isVirtualDriveFolder(folder.value);
        const query = isVirtual ? folder.value.query ?? {} : {};
        const folderId = !isVirtual && folder.value ? folder.value.id : null;

        const shouldFetchFolders = !isVirtual;
        const foldersPromise = shouldFetchFolders
                ? os
                              .api("drive/folders", {
                                      folderId: folderId,
                                      limit: foldersMax + 1,
                              })
                              .then((fetchedFolders) => {
                                      if (fetchedFolders.length === foldersMax + 1) {
                                              moreFolders.value = true;
                                              fetchedFolders.pop();
                                      }
                                      return fetchedFolders as DriveFolderLike[];
                              })
                : Promise.resolve<DriveFolderLike[]>([]);

        const filesPromise = os
                .api("drive/files", {
                        folderId: folderId,
                        type: query.type ?? props.type,
                        fromDate: query.fromDate,
                        untilDate: query.untilDate,
                        limit: filesMax + 1,
                })
                .then((fetchedFiles) => {
                        if (fetchedFiles.length === filesMax + 1) {
                                moreFiles.value = true;
                                fetchedFiles.pop();
                        }
                        return fetchedFiles;
                });

        const autoDataPromise =
                !isVirtual && folder.value == null
                        ? getAutoFoldersData().catch(() => null)
                        : Promise.resolve<AutoFoldersData | null>(null);

        const [fetchedFolders, fetchedFiles, autoData] = await Promise.all([
                foldersPromise,
                filesPromise,
                autoDataPromise,
        ]);

        if (!isVirtual && folder.value == null && autoData) {
                if (autoData.months.length > 0) {
                        folders.value.push(createYearMonthRootFolder());
                }
                if (autoData.types.length > 0) {
                        folders.value.push(createFileTypeRootFolder());
                }
        }

        for (const x of fetchedFolders) appendFolder(x);
        for (const x of fetchedFiles) appendFile(x);

        fetching.value = false;
}

function fetchMoreFiles() {
        fetching.value = true;

        const max = 30;

        if (files.value.length === 0) {
                fetching.value = false;
                return;
        }

        // ファイル一覧取得
        os.api("drive/files", {
                folderId:
                        !isVirtualDriveFolder(folder.value) && folder.value
                                ? folder.value.id
                                : null,
                type:
                        (isVirtualDriveFolder(folder.value)
                                ? folder.value.query?.type
                                : undefined) ?? props.type,
                fromDate: isVirtualDriveFolder(folder.value)
                        ? folder.value.query?.fromDate
                        : undefined,
                untilDate: isVirtualDriveFolder(folder.value)
                        ? folder.value.query?.untilDate
                        : undefined,
                untilId: files.value[files.value.length - 1].id,
                limit: max + 1,
        }).then((files) => {
                if (files.length === max + 1) {
                        moreFiles.value = true;
			files.pop();
		} else {
			moreFiles.value = false;
		}
		for (const x of files) appendFile(x);
		fetching.value = false;
	});
}

function getMenu() {
        const isVirtualCurrent = isVirtualDriveFolder(folder.value);
        const currentFolderName = folder.value
                ? isVirtualCurrent
                        ? folder.value.name
                        : (folder.value as Misskey.entities.DriveFolder).name
                : i18n.ts.drive;

        return [
                {
                        text: i18n.ts.addFile,
                        type: "label",
                },
		{
			text: i18n.ts.upload,
			icon: "ph-upload-simple ph-bold ph-lg",
			action: () => {
				selectLocalFile();
			},
		},
		{
			text: i18n.ts.fromUrl,
			icon: "ph-link-simple ph-bold ph-lg",
			action: () => {
				urlUpload();
			},
		},
		null,
		{
			type: "switch",
			text: i18n.ts.keepOriginalUploading,
			ref: keepOriginal,
		},
                {
                        type: "switch",
                        text: i18n.ts.keepFileName,
                        ref: keepFileName,
                },
                null,
                {
                        text: currentFolderName,
                        type: "label",
                },
                !isVirtualCurrent && folder.value
                        ? {
                                        text: i18n.ts.renameFolder,
                                        icon: "ph-cursor-text ph-bold ph-lg",
                                        action: () => {
                                                renameFolder(
                                                        folder.value as Misskey.entities.DriveFolder,
                                                );
                                        },
                          }
                        : undefined,
                !isVirtualCurrent && folder.value
                        ? {
                                        text: i18n.ts.deleteFolder,
                                        icon: "ph-trash ph-bold ph-lg",
                                        action: () => {
                                                deleteFolder(
                                                        folder.value as Misskey.entities.DriveFolder
                                                );
                                        },
                          }
                        : undefined,
                !isVirtualCurrent
                        ? {
                                        text: i18n.ts.createFolder,
                                        icon: "ph-folder-notch-plus ph-bold ph-lg",
                                        action: () => {
                                                createFolder();
                                        },
                          }
                        : undefined,
        ];
}

function showMenu(ev: MouseEvent) {
	os.popupMenu(
		getMenu(),
		(ev.currentTarget ?? ev.target ?? undefined) as HTMLElement | undefined
	);
}

function onContextmenu(ev: MouseEvent) {
	os.contextMenu(getMenu(), ev);
}

onMounted(() => {
	if (defaultStore.state.enableInfiniteScroll && loadMoreFiles.value) {
		nextTick(() => {
			ilFilesObserver.observe(loadMoreFiles.value?.$el);
		});
	}

	connection.on("fileCreated", onStreamDriveFileCreated);
	connection.on("fileUpdated", onStreamDriveFileUpdated);
	connection.on("fileDeleted", onStreamDriveFileDeleted);
	connection.on("folderCreated", onStreamDriveFolderCreated);
	connection.on("folderUpdated", onStreamDriveFolderUpdated);
	connection.on("folderDeleted", onStreamDriveFolderDeleted);

	if (props.initialFolder) {
		move(props.initialFolder);
	} else {
		fetch();
	}
});

onActivated(() => {
	if (defaultStore.state.enableInfiniteScroll) {
		nextTick(() => {
			ilFilesObserver.observe(loadMoreFiles.value?.$el);
		});
	}
});

onBeforeUnmount(() => {
	connection.dispose();
	ilFilesObserver.disconnect();
});
</script>

<style lang="scss" scoped>
.yfudmmck {
	display: flex;
	flex-direction: column;
	height: 100%;

	> nav {
		display: flex;
		z-index: 2;
		width: 100%;
		padding: 0 0.5rem;
		box-sizing: border-box;
		overflow: auto;
		font-size: 0.9em;
		box-shadow: 0 0.0625rem 0 var(--divider);

		&,
		* {
			user-select: none;
		}

		> .path {
			display: inline-block;
			vertical-align: bottom;
			line-height: 2.625rem;
			white-space: nowrap;

			> * {
				display: inline-block;
				margin: 0;
				padding: 0 0.5rem;
				line-height: 2.625rem;
				cursor: pointer;

				* {
					pointer-events: none;
				}

				&:hover {
					text-decoration: underline;
				}

				&.current {
					font-weight: bold;
					cursor: default;

					&:hover {
						text-decoration: none;
					}
				}

				&.separator {
					margin: 0;
					padding: 0;
					opacity: 0.5;
					cursor: default;

					> i {
						margin: 0;
					}
				}
			}
		}

		> .menu {
			margin-left: auto;
			padding: 0 0.75rem;
		}
	}

	> .main {
		flex: 1;
		overflow: auto;
		padding: var(--margin);

		&,
		* {
			user-select: none;
		}

		&.fetching {
			cursor: wait !important;

			* {
				pointer-events: none;
			}

			> .contents {
				opacity: 0.5;
			}
		}

		&.uploading {
			height: calc(100% - 2.375rem - 6.25rem);
		}

		> .contents {
			> .folders,
			> .files {
				display: flex;
				flex-wrap: wrap;

				> .folder,
				> .file {
					flex-grow: 1;
					width: 8rem;
					margin: 0.25rem;
					box-sizing: border-box;
				}

				> .padding {
					flex-grow: 1;
					pointer-events: none;
					width: 8rem + 0.5rem;
				}
			}

			> .empty {
				padding: 1rem;
				text-align: center;
				pointer-events: none;
				opacity: 0.5;

				> p {
					margin: 0;
				}
			}
		}
	}

	> .dropzone {
		position: absolute;
		left: 0;
		top: 2.375rem;
		width: 100%;
		height: calc(100% - 2.375rem);
		border: dashed 0.125rem var(--focus);
		pointer-events: none;
	}

	> input {
		display: none;
	}
}
</style>
