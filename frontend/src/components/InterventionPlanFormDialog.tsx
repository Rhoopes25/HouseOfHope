import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createResidentPlan, updateResidentPlan } from '@/lib/api-endpoints';
import type { InterventionPlan, Resident } from '@/lib/types';
import { EditableSelect } from '@/components/EditableSelect';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { toTitleCase } from '@/lib/titleCase';
import { planCategoryLabel, PLAN_STATUS_LABELS } from '@/lib/residentFieldOptions';

function matchSelectOption(value: string, options: string[]): { select: string; other: string } {
  const n = value.trim().toLowerCase();
  const hit = options.find((o) => o.trim().toLowerCase() === n);
  if (hit) return { select: hit, other: '' };
  if (!value.trim()) return { select: '', other: '' };
  return { select: 'other', other: value };
}

function emptyPlanForm() {
  return {
    planCategory: '',
    planCategoryOther: '',
    description: '',
    servicesProvided: '',
    targetDate: '',
    status: 'pending' as 'pending' | 'in-progress' | 'completed' | 'on-hold',
    caseConferenceDate: '',
  };
}

export type InterventionPlanFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseResidentId: string;
  residentPicker?: {
    value: string;
    onChange: (id: string) => void;
    residents: Resident[];
  };
  planCategoryOptions: string[];
  editingPlan: InterventionPlan | null;
};

export function InterventionPlanFormDialog({
  open,
  onOpenChange,
  baseResidentId,
  residentPicker,
  planCategoryOptions,
  editingPlan,
}: InterventionPlanFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [planForm, setPlanForm] = useState(emptyPlanForm);

  useEffect(() => {
    if (!open) return;
    if (editingPlan) {
      const pc = matchSelectOption(editingPlan.planCategory, planCategoryOptions);
      setPlanForm({
        planCategory: pc.select === 'other' ? 'other' : pc.select,
        planCategoryOther: pc.select === 'other' ? pc.other : '',
        description: editingPlan.description,
        servicesProvided: editingPlan.servicesProvided,
        targetDate: editingPlan.targetDate,
        status: editingPlan.status,
        caseConferenceDate: editingPlan.caseConferenceDate,
      });
    } else {
      setPlanForm(emptyPlanForm());
    }
  }, [open, editingPlan, planCategoryOptions]);

  const effectiveResidentId = useMemo(() => {
    if (residentPicker) {
      return residentPicker.value.trim();
    }
    return baseResidentId;
  }, [residentPicker, baseResidentId]);

  const apiResidentId = editingPlan ? editingPlan.residentId : effectiveResidentId;

  const saveMutation = useMutation({
    mutationFn: () => {
      const planCategory =
        planForm.planCategory === 'other' ? toTitleCase(planForm.planCategoryOther) : planForm.planCategory.trim();
      const payload = {
        planCategory,
        description: planForm.description.trim(),
        servicesProvided: planForm.servicesProvided.trim(),
        targetDate: planForm.targetDate,
        status: planForm.status,
        caseConferenceDate: planForm.caseConferenceDate,
      };
      return editingPlan
        ? updateResidentPlan(apiResidentId, editingPlan.id, payload)
        : createResidentPlan(apiResidentId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resident', apiResidentId, 'plans'] });
      await queryClient.invalidateQueries({ queryKey: ['intervention-plans-all'] });
      await queryClient.invalidateQueries({ queryKey: ['process-recordings'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onOpenChange(false);
      toast({ title: 'Plan saved', description: 'Intervention plan updated.' });
    },
    onError: () => toast({ title: 'Save failed', description: 'Could not save intervention plan.', variant: 'destructive' }),
  });

  const canSave =
    !!planForm.planCategory &&
    (planForm.planCategory !== 'other' || !!planForm.planCategoryOther.trim()) &&
    (!residentPicker || !!residentPicker.value.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl w-[min(100vw-2rem,36rem)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="font-display">
            {editingPlan ? 'Edit Intervention Plan' : 'Add Intervention Plan'}
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
          <EditableSelect
            label="Plan Category"
            allowEmpty
            placeholder="Select plan category"
            value={planForm.planCategory}
            customValue={planForm.planCategoryOther}
            options={planCategoryOptions}
            getOptionLabel={(o) => planCategoryLabel(o)}
            onChange={(v) => setPlanForm({ ...planForm, planCategory: v })}
            onCustomChange={(v) => setPlanForm({ ...planForm, planCategoryOther: v })}
          />
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea rows={4} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Services Provided</Label>
            <Textarea rows={3} value={planForm.servicesProvided} onChange={(e) => setPlanForm({ ...planForm, servicesProvided: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Target Date</Label>
              <Input type="date" value={planForm.targetDate} onChange={(e) => setPlanForm({ ...planForm, targetDate: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Case Conference Date</Label>
              <Input
                type="date"
                value={planForm.caseConferenceDate}
                onChange={(e) => setPlanForm({ ...planForm, caseConferenceDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={planForm.status}
              onValueChange={(v: 'pending' | 'in-progress' | 'completed' | 'on-hold') => setPlanForm({ ...planForm, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PLAN_STATUS_LABELS) as (keyof typeof PLAN_STATUS_LABELS)[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PLAN_STATUS_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border-t px-6 py-4 shrink-0 flex justify-end gap-2 bg-muted/30">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canSave}>
            {saveMutation.isPending ? 'Saving...' : 'Save Plan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
