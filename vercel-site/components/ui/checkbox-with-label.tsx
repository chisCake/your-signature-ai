import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface CheckboxWithLabelProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  className?: string;
  labelClassName?: string;
}

export function CheckboxWithLabel({
  id,
  checked,
  onCheckedChange,
  label,
  className = 'w-6 h-6',
  labelClassName = 'cursor-pointer select-none',
}: CheckboxWithLabelProps) {
  return (
    <div className='flex items-center gap-2'>
      <Checkbox
        className={className}
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <Label className={labelClassName} htmlFor={id}>
        {label}
      </Label>
    </div>
  );
}
