"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowLeft,
	CheckCircle2,
	Loader2,
	Phone,
	SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import {
	fetchNextQueueContactsAction,
	recordCallAttemptAction,
} from "@/app/actions/calls";
import { CallHistoryPanel } from "@/components/calls/call-history-panel";
import { CallResponseBadge } from "@/components/calls/call-response-badge";
import { CallScriptButton } from "@/components/calls/call-script-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCallQueueFormDefaults } from "@/lib/calls/form-defaults";
import {
	applySavedCallToQueueStats,
	revertSavedCallOnQueueStats,
} from "@/lib/calls/queue-stats";
import {
	buildTelLink,
	buildWhatsAppLink,
	buildWhatsAppMessage,
	CALL_NOTE_SUGGESTIONS,
	CALL_RESPONSE_SHORT_LABELS,
} from "@/lib/config/calling";
import type {
	CallQueueContact,
	CallQueueStats,
	CallResponse,
	WhatsAppMessageTemplate,
} from "@/types/domain";
import { CALL_RESPONSES } from "@/types/domain";
import { useRouter } from "next/navigation";

const PREFETCH_LIMIT = 2;

type CallQueuePanelProps = {
	initialContacts: CallQueueContact[];
	stats: CallQueueStats;
	campaignId?: string;
	whatsAppTemplates: WhatsAppMessageTemplate[];
	defaultTemplateId: string | null;
};

function replaceQueueContactId(contactId: string | null) {
	if (typeof window === "undefined") {
		return;
	}

	const params = new URLSearchParams(window.location.search);
	if (contactId) {
		params.set("contactId", contactId);
	} else {
		params.delete("contactId");
	}

	const query = params.toString();
	window.history.replaceState(
		window.history.state,
		"",
		query ? `${window.location.pathname}?${query}` : window.location.pathname,
	);
}

export function CallQueuePanel({
	initialContacts,
	stats: initialStats,
	campaignId,
	whatsAppTemplates,
	defaultTemplateId,
}: CallQueuePanelProps) {
	const [queue, setQueue] = useState(initialContacts);
	const [stats, setStats] = useState(initialStats);
	const [isRefilling, setIsRefilling] = useState(false);
	const initialForm = getCallQueueFormDefaults(initialContacts[0] ?? null);
	const [selectedTemplateId, setSelectedTemplateId] = useState(
		defaultTemplateId ?? whatsAppTemplates[0]?.id ?? "",
	);
	const [selectedResponse, setSelectedResponse] = useState<CallResponse | null>(
		initialForm.response,
	);
	const [notes, setNotes] = useState(initialForm.notes);

	const queueRef = useRef(queue);
	const excludedIdsRef = useRef(new Set<string>());
	const refillPromiseRef = useRef<Promise<void> | null>(null);
	const restoreFormRef = useRef(
		new Map<string, { response: CallResponse; notes: string }>(),
	);
	const router = useRouter();

	queueRef.current = queue;

	const currentContact = queue[0] ?? null;

	const templateItems = useMemo(
		() =>
			whatsAppTemplates.map(template => ({
				label: template.name,
				value: template.id,
			})),
		[whatsAppTemplates],
	);

	useEffect(() => {
		if (!currentContact) {
			return;
		}

		const draft = restoreFormRef.current.get(currentContact.id);
		if (draft) {
			setSelectedResponse(draft.response);
			setNotes(draft.notes);
			return;
		}

		const defaults = getCallQueueFormDefaults(currentContact);
		setSelectedResponse(defaults.response);
		setNotes(defaults.notes);
	}, [currentContact?.id]);

	const completedCount = stats.completed;
	const totalCount = stats.assigned;

	const refillQueue = (extraSkipIds: string[] = []) => {
		if (refillPromiseRef.current) {
			return refillPromiseRef.current;
		}

		const pending = (async () => {
			const skipContactIds = [
				...new Set([
					...excludedIdsRef.current,
					...queueRef.current.map(contact => contact.id),
					...extraSkipIds,
				]),
			];

			const result = await fetchNextQueueContactsAction({
				...(campaignId ? { campaignId } : {}),
				skipContactIds,
				limit: PREFETCH_LIMIT,
			});

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			const nextContacts = result.data?.contacts ?? [];
			if (nextContacts.length === 0) {
				return;
			}

			setQueue(current => {
				const seen = new Set(current.map(contact => contact.id));
				const additions = nextContacts.filter(
					contact =>
						!seen.has(contact.id) && !excludedIdsRef.current.has(contact.id),
				);
				return additions.length > 0 ? [...current, ...additions] : current;
			});
		})()
			.catch(() => {
				toast.error("Could not load the next contact.");
			})
			.finally(() => {
				refillPromiseRef.current = null;
				setIsRefilling(false);
			});

		refillPromiseRef.current = pending;
		return pending;
	};

	const advanceQueue = (contact: CallQueueContact) => {
		excludedIdsRef.current.add(contact.id);
		const remaining = queueRef.current.filter(item => item.id !== contact.id);
		queueRef.current = remaining;
		setQueue(remaining);
		replaceQueueContactId(remaining[0]?.id ?? null);

		if (remaining.length <= 1) {
			setIsRefilling(remaining.length === 0);
			void refillQueue([contact.id]);
		}
	};

	const handleSkip = () => {
		if (!currentContact || excludedIdsRef.current.has(currentContact.id))
			return;
		advanceQueue(currentContact);
	};

	const handleSaveAndNext = () => {
		if (!currentContact || excludedIdsRef.current.has(currentContact.id))
			return;

		if (!selectedResponse) {
			toast.error("Select how the call went.");
			return;
		}

		if (selectedResponse === "OTHER" && !notes.trim()) {
			toast.error("Please add notes when selecting Other.");
			return;
		}

		const savedContact = currentContact;
		const previousResponse = savedContact.latest_response;
		const response = selectedResponse;
		const savedNotes = notes.trim() || undefined;

		setStats(
			applySavedCallToQueueStats(stats, response, {
				previousResponse,
			}),
		);
		advanceQueue(savedContact);

		void recordCallAttemptAction({
			contactId: savedContact.id,
			response,
			notes: savedNotes,
		}).then(result => {
			if (result.success) {
				restoreFormRef.current.delete(savedContact.id);
				return;
			}

			restoreFormRef.current.set(savedContact.id, {
				response,
				notes: savedNotes ?? "",
			});
			excludedIdsRef.current.delete(savedContact.id);
			setQueue(current => {
				const restored = current.some(contact => contact.id === savedContact.id)
					? current
					: [
							savedContact,
							...current.filter(contact => contact.id !== savedContact.id),
						];
				queueRef.current = restored;
				return restored;
			});
			setStats(current =>
				revertSavedCallOnQueueStats(current, response, { previousResponse }),
			);
			setSelectedResponse(response);
			setNotes(savedNotes ?? "");
			replaceQueueContactId(savedContact.id);
			toast.error(result.error);
		});
	};

	if (!currentContact) {
		if (isRefilling) {
			return (
				<div className="mx-auto flex min-h-112 max-w-lg flex-col items-center justify-center gap-4 px-2 py-16 text-center">
					<Loader2 className="size-10 animate-spin text-primary" />
					<p className="font-heading text-xl font-semibold tracking-tight">
						Loading next contact
					</p>
				</div>
			);
		}

		return (
			<div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-2 py-10 text-center">
				<CheckCircle2 className="size-16 text-primary" />
				<div className="space-y-2">
					<h2 className="font-heading text-2xl font-semibold">
						Queue complete
					</h2>
					<p className="text-sm text-muted-foreground">
						You have worked through all available contacts. {completedCount} of{" "}
						{totalCount} completed.
					</p>
				</div>
				<div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
					<Button
						className="min-h-12 flex-1 text-base"
						render={<Link href="/my-calls/list" />}>
						View all contacts
					</Button>
					<Button
						variant="outline"
						className="min-h-12 flex-1 text-base"
						render={<Link href="/my-calls" />}>
						Back to My Calls
					</Button>
				</div>
			</div>
		);
	}

	const telLink = buildTelLink(currentContact.phone_normalized);
	const selectedTemplate =
		whatsAppTemplates.find(template => template.id === selectedTemplateId) ??
		whatsAppTemplates.find(template => template.is_default) ??
		whatsAppTemplates[0];
	const whatsAppLink = buildWhatsAppLink(
		currentContact.phone_normalized,
		buildWhatsAppMessage(
			currentContact.name,
			currentContact.campaign_name,
			selectedTemplate?.body,
		),
	);

	return (
		<div className="mx-auto flex max-w-lg flex-col gap-5">
			<div className="flex items-center justify-between gap-3">
				<Button
					variant="ghost"
					size="sm"
					className="px-0"
					onClick={() => router.back()}>
					<ArrowLeft />
					Go Back
				</Button>
				<p className="text-sm font-medium text-muted-foreground">
					{completedCount} / {totalCount} completed
				</p>
			</div>

			<AnimatePresence mode="wait">
				<motion.div
					key={currentContact.id}
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -12 }}
					transition={{ duration: 0.18 }}
					className="space-y-5">
					<div className="rounded-2xl border bg-card p-5 shadow-sm">
						<p className="text-sm text-muted-foreground">
							{currentContact.campaign_name}
						</p>
						<h2 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
							{currentContact.name}
						</h2>
						<a
							href={telLink}
							className="mt-3 block font-heading text-2xl font-medium text-primary underline-offset-4 hover:underline">
							{currentContact.phone}
						</a>

						{currentContact.latest_response ? (
							<div className="mt-4">
								<CallResponseBadge response={currentContact.latest_response} />
							</div>
						) : null}

						{currentContact.latest_notes?.trim() ? (
							<p className="mt-3 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
								{currentContact.latest_notes}
							</p>
						) : null}

						{currentContact.attempt_count > 0 ? (
							<p className="mt-3 text-sm text-muted-foreground">
								{currentContact.attempt_count} previous attempt
								{currentContact.attempt_count === 1 ? "" : "s"} recorded
							</p>
						) : null}
					</div>

					<div className="grid grid-cols-2 gap-3">
						<Button
							nativeButton={false}
							render={<a href={telLink} />}
							className="min-h-14 text-base"
							size="lg">
							<Phone />
							Call
						</Button>
						<Button
							nativeButton={false}
							variant="outline"
							render={
								<a
									href={whatsAppLink}
									target="_blank"
									rel="noopener noreferrer"
								/>
							}
							className="min-h-14 text-base"
							size="lg">
							WhatsApp
						</Button>
					</div>

					{currentContact.campaign_call_script?.trim() ? (
						<CallScriptButton
							campaignName={currentContact.campaign_name}
							script={currentContact.campaign_call_script}
						/>
					) : null}

					{whatsAppTemplates.length > 0 ? (
						<div className="space-y-2">
							<Label htmlFor="whatsapp-template">
								WhatsApp message template
							</Label>
							<Select
								value={selectedTemplateId}
								items={templateItems}
								onValueChange={value => setSelectedTemplateId(value ?? "")}>
								<SelectTrigger id="whatsapp-template" className="w-full">
									<SelectValue placeholder="Choose a template" />
								</SelectTrigger>
								<SelectContent>
									{whatsAppTemplates.map(template => (
										<SelectItem key={template.id} value={template.id}>
											{template.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{selectedTemplate ? (
								<p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
									{buildWhatsAppMessage(
										currentContact.name,
										currentContact.campaign_name,
										selectedTemplate.body,
									)}
								</p>
							) : null}
						</div>
					) : null}

					<CallHistoryPanel attempts={currentContact.prior_attempts} />

					<div className="space-y-3">
						<p className="text-sm font-medium">How did the call go?</p>
						<div className="grid grid-cols-2 gap-2">
							{CALL_RESPONSES.map(response => (
								<Button
									key={response}
									type="button"
									variant={
										selectedResponse === response ? "default" : "outline"
									}
									className="min-h-12 justify-center text-sm"
									onClick={() => setSelectedResponse(response)}>
									{CALL_RESPONSE_SHORT_LABELS[response]}
								</Button>
							))}
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="call-notes">Notes</Label>
						<Textarea
							id="call-notes"
							value={notes}
							onChange={event => {
								setNotes(event.target.value);
							}}
							placeholder="Optional details (required for Other)"
							rows={3}
						/>
						<div className="flex flex-wrap gap-2">
							{CALL_NOTE_SUGGESTIONS.map(suggestion => (
								<Button
									key={suggestion}
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										setNotes(current =>
											current.trim()
												? `${current.trim()}\n${suggestion}`
												: suggestion,
										);
									}}>
									{suggestion}
								</Button>
							))}
						</div>
					</div>

					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							className="min-h-12 flex-1"
							onClick={handleSkip}>
							<SkipForward />
							Skip
						</Button>
						<Button
							type="button"
							className="min-h-12 flex-[2] text-base"
							disabled={!selectedResponse}
							onClick={handleSaveAndNext}>
							Save & Next
						</Button>
					</div>
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
