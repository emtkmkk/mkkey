import type Bull from "bull";
import type { NoteApDeliverJobData } from "../types.js";
import { processNoteApDeliverJob } from "@/services/note/ap-deliver.js";

export default async function processNoteApDeliver(
	job: Bull.Job<NoteApDeliverJobData>,
) {
	await processNoteApDeliverJob(job.data);
	return "Success";
}
