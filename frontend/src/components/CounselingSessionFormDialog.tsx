import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createResidentSession, updateResidentSession } from '@/lib/api-endpoints';
import type { CounselingSession, Resident } from '@/lib/types';
import { EditableSelect } from '@/components/EditableSelect';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { toTitleCase } from '@/lib/titleCase';
import { SESSION_DURATION_PRESETS } from '@/lib/residentFieldOptions';

function matchSelectOption(value: string, options: string[]): { select: string; other: string } {
  const n = value.trim().toLowerCase();
  const hit = options.find((o) => o.trim().toLowerCase() === n);
  if (hit) return { select: hit, other: '' };
  if (!value.trim()) return { select: '', other: '' };
  return { select: 'other', other: value };
}

function emptySessionForm() {
  return {
    sessionDate: new Date().toISOString().slice(0, 10),
    socialWorker: '',
    socialWorkerOther: '',
    sessionType: 'individual' as 'individual' | 'group',
    durationPreset: '60' as string,
    durationMinutes: 60,
    emotionalStateStart: '',
    emotionalStateStartOther: '',
    emotionalStateEnd: '',
    emotionalStateEndOther: '',
    narrative: '',
    interventions: '',
    followUpActions: '',
    progressNoted: false,
    concernsFlagged: false,
  };
}

export type CounselingSessionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Used when `residentPicker` is not shown (resident profile page). */
  baseResidentId: string;
  /** When set, user chooses resident (Process Recording page). `value` is resident id. */
  residentPicker?: {
    value: string;
    onChange: (id: string) => void;
    residents: Resident[];
  };
  socialWorkerOptions: string[];
  emotionalStateOptions: string[];
  editingSession: CounselingSession | null;
};

export function CounselingSessionFormDialog({
  open,
  onOpenChange,
  baseResidentId,
  residentPicker,
  socialWorkerOptions,
  emotionalStateOptions,
  editingSession,
}: CounselingSessionFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sessionForm, setSessionForm] = useState(emptySessionForm);

  useEffect(() => {
    if (!open) return;
    if (editingSession) {
      const sw = matchSelectOption(editingSession.socialWorker, socialWorkerOptions);
      const es = matchSelectOption(editingSession.emotionalStateStart, emotionalStateOptions);
      const ee = matchSelectOption(editingSession.emotionalStateEnd, emotionalStateOptions);
      const inPreset = SESSION_DURATION_PRESETS.includes(
        editingSession.durationMinutes as (typeof SESSION_DURATION_PRESETS)[number],
      );
      setSessionForm({
        sessionDate: editingSession.sessionDate,
        socialWorker: sw.select === 'other' ? 'other' : sw.select,
        socialWorkerOther: sw.select === 'other' ? sw.other : '',
        sessionType: editingSession.sessionType,
        durationPreset: inPreset ? String(editingSession.durationMinutes) : 'other',
        durationMinutes: editingSession.durationMinutes,
        emotionalStateStart: es.select === 'other' ? 'other' : es.select,
        emotionalStateStartOther: es.select === 'other' ? es.other : '',
        emotionalStateEnd: ee.select === 'other' ? 'other' : ee.select,
        emotionalStateEndOther: ee.select === 'other' ? ee.other : '',
        narrative: editingSession.narrative,
        interventions: editingSession.interventions,
        followUpActions: editingSession.followUpActions,
        progressNoted: editingSession.progressNoted,
        concernsFlagged: editingSession.concernsFlagged,
      });
    } else {
      setSessionForm(emptySessionForm());
    }
  }, [open, editingSession, socialWorkerOptions, emotionalStateOptions]);

  const effectiveResidentId = useMemo(() => {
    if (residentPicker) {
      return residentPicker.value.trim();
    }
    return baseResidentId;
  }, [residentPicker, baseResidentId]);

  const apiResidentId = editingSession ? editingSession.residentId : effectiveResidentId;

  const buildSessionApiPayload = () => {
    const socialWorker =
      sessionForm.socialWorker === 'other'
        ? sessionForm.socialWorkerOther.trim()
        : sessionForm.socialWorker.trim();
    const emotionalStateStart =
      sessionForm.emotionalStateStart === 'other'
        ? toTitleCase(sessionForm.emotionalStateStartOther)
        : sessionForm.emotionalStateStart.trim();
    const emotionalStateEnd =
      sessionForm.emotionalStateEnd === 'other'
        ? toTitleCase(sessionForm.emotionalStateEndOther)
        : sessionForm.emotionalStateEnd.trim();
    const durationMinutes =
      sessionForm.durationPreset === 'other' ? sessionForm.durationMinutes : Number(sessionForm.durationPreset);
    return {
      sessionDate: sessionForm.sessionDate,
      socialWorker,
      sessionType: sessionForm.sessionType,
      durationMinutes,
      emotionalStateStart,
      emotionalStateEnd,
      narrative: sessionForm.narrative.trim(),
      interventions: sessionForm.interventions.trim(),
      followUpActions: sessionForm.followUpActions.trim(),
      progressNoted: sessionForm.progressNoted,
      concernsFlagged: sessionForm.concernsFlagged,
    };
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = buildSessionApiPayload();
      return editingSession
        ? updateResidentSession(apiResidentId, editingSession.id, payload)
        : createResidentSession(apiResidentId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', apiResidentId, 'sessions'] });
      await queryClient.invalidateQueries({ queryKey: ['process-recordings'] });
      await queryClient.invalidateQueries({ queryKey: ['intervention-plans-all'] });
      onOpenChange(false);
      toast({ title: 'Session saved', description: 'Counseling session updated.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not save session.', variant: 'destructive' }),
  });

  const canSave =
    !!sessionForm.sessionDate &&
    !!(sessionForm.socialWorker === 'other' ? sessionForm.socialWorkerOther.trim() : sessionForm.socialWorker.trim()) &&
    (!residentPicker || !!residentPicker.value.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl w-[min(100vw-2rem,36rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="font-display">
            {editingSession ? 'Edit Counseling Session' : 'Add Counseling Session'}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto px-6 pb-4 flex-1 min-h-0 space-y-3">
          {residentPicker && (
            <div className="grid gap-2">
              <Label>Resident</Label>
              <Select
                value={residentPicker.value || '__none__'}
                onValueChange={(v) => residentPicker.onChange(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select resident" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__" className="text-muted-foreground">
                    Select resident
                  </SelectItem>
                  {residentPicker.residents.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.internalCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Session Date</Label>
              <Input
                type="date"
                value={sessionForm.sessionDate}
                onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })}
              />
            </div>
            <EditableSelect
              label="Social Worker"
              allowEmpty
              placeholder="Select social worker"
              value={sessionForm.socialWorker}
              customValue={sessionForm.socialWorkerOther}
              options={socialWorkerOptions}
              onChange={(v) => setSessionForm({ ...sessionForm, socialWorker: v })}
              onCustomChange={(v) => setSessionForm({ ...sessionForm, socialWorkerOther: v })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={sessionForm.sessionType}
                onValueChange={(v: 'individual' | 'group') => setSessionForm({ ...sessionForm, sessionType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Duration</Label>
              <Select
                value={sessionForm.durationPreset}
                onValueChange={(v) =>
                  setSessionForm({
                    ...sessionForm,
                    durationPreset: v,
                    durationMinutes: v === 'other' ? sessionForm.durationMinutes : Number(v),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_DURATION_PRESETS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} Minutes
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {sessionForm.durationPreset === 'other' && (
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={sessionForm.durationMinutes || ''}
                  onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: Number(e.target.value) })}
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditableSelect
              label="Emotional State (Start)"
              allowEmpty
              placeholder="Select observed state"
              value={sessionForm.emotionalStateStart}
              customValue={sessionForm.emotionalStateStartOther}
              options={emotionalStateOptions}
              onChange={(v) => setSessionForm({ ...sessionForm, emotionalStateStart: v })}
              onCustomChange={(v) => setSessionForm({ ...sessionForm, emotionalStateStartOther: v })}
            />
            <EditableSelect
              label="Emotional State (End)"
              allowEmpty
              placeholder="Select observed state"
              value={sessionForm.emotionalStateEnd}
              customValue={sessionForm.emotionalStateEndOther}
              options={emotionalStateOptions}
              onChange={(v) => setSessionForm({ ...sessionForm, emotionalStateEnd: v })}
              onCustomChange={(v) => setSessionForm({ ...sessionForm, emotionalStateEndOther: v })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Narrative</Label>
            <Textarea rows={4} value={sessionForm.narrative} onChange={(e) => setSessionForm({ ...sessionForm, narrative: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Interventions</Label>
            <Textarea rows={3} value={sessionForm.interventions} onChange={(e) => setSessionForm({ ...sessionForm, interventions: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Follow-Up Actions</Label>
            <Textarea rows={3} value={sessionForm.followUpActions} onChange={(e) => setSessionForm({ ...sessionForm, followUpActions: e.target.value })} />
          </div>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={sessionForm.progressNoted}
              onChange={(e) => setSessionForm({ ...sessionForm, progressNoted: e.target.checked })}
            />
            Progress Noted
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={sessionForm.concernsFlagged}
              onChange={(e) => setSessionForm({ ...sessionForm, concernsFlagged: e.target.checked })}
            />
            Concerns Flagged
          </label>
        </div>
        <div className="border-t px-6 py-4 shrink-0 flex justify-end gap-2 bg-muted/30">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canSave}>
            {saveMutation.isPending ? 'Saving...' : 'Save Session'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
