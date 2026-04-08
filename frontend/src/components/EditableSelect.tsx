import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditableSelectProps {
  label: string;
  value: string;
  customValue: string;
  options: string[];
  onChange: (value: string) => void;
  onCustomChange: (value: string) => void;
  placeholder?: string;
  /** When set, options are shown with this label while the stored value stays the option string. */
  getOptionLabel?: (option: string) => string;
}

export function EditableSelect({
  label,
  value,
  customValue,
  options,
  onChange,
  onCustomChange,
  placeholder = 'Select a value',
  getOptionLabel,
}: EditableSelectProps) {
  const normalized = value.trim().toLowerCase();
  const known = options.some((opt) => opt.trim().toLowerCase() === normalized);
  const selectValue = known ? value : 'other';

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={selectValue} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {getOptionLabel ? getOptionLabel(option) : option}
            </SelectItem>
          ))}
          <SelectItem value="other">Other (type new value)</SelectItem>
        </SelectContent>
      </Select>
      {selectValue === 'other' && (
        <Input
          placeholder={`Enter new ${label.toLowerCase()}`}
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
        />
      )}
    </div>
  );
}
