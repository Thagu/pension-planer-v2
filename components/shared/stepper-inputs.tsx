"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSwissNumber, parseSwissNumber } from "@/lib/format/numbers";
import { cn } from "@/lib/utils";

export function StepperButtons({
  onUp,
  onDown,
  upDisabled,
  downDisabled,
  label,
}: {
  onUp: () => void;
  onDown: () => void;
  upDisabled?: boolean;
  downDisabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-px">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-5 w-7 rounded-b-none px-0"
        disabled={upDisabled}
        aria-label={`${label} erhöhen`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onUp();
        }}
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-5 w-7 rounded-t-none border-t-0 px-0"
        disabled={downDisabled}
        aria-label={`${label} verringern`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onDown();
        }}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

type ChfStepperInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  step?: number;
  min?: number;
  allowZero?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export function ChfStepperInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  step = 10_000,
  min = 0,
  allowZero = false,
  placeholder,
  className,
  inputClassName,
  disabled = false,
  ariaLabel = "Betrag",
}: ChfStepperInputProps) {
  const adjust = (delta: number) => {
    const parsed = parseSwissNumber(value);
    const next = Math.max(min, parsed + delta);
    const formatted = formatSwissNumber(next, allowZero);
    onChange({
      target: { value: formatted, name: name ?? "" },
    } as React.ChangeEvent<HTMLInputElement>);
    onBlur?.();
  };

  const parsed = parseSwissNumber(value);
  const downDisabled = disabled || parsed <= min;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          CHF
        </span>
        <Input
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pl-12 font-mono tabular-nums", inputClassName)}
        />
      </div>
      <StepperButtons
        label={ariaLabel}
        onUp={() => adjust(step)}
        onDown={() => adjust(-step)}
        upDisabled={disabled}
        downDisabled={downDisabled}
      />
    </div>
  );
}

export function ChfStepperField({
  id,
  name,
  label,
  ...inputProps
}: ChfStepperInputProps & { label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <ChfStepperInput id={id} name={name} ariaLabel={label} {...inputProps} />
    </div>
  );
}

type NumberStepperInputProps = {
  id?: string;
  name?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
};

export function NumberStepperInput({
  id,
  name,
  value,
  onChange,
  step = 1,
  min,
  max,
  className,
  inputClassName,
  disabled = false,
  placeholder,
  ariaLabel = "Wert",
}: NumberStepperInputProps) {
  const numeric = typeof value === "number" ? value : parseFloat(value) || 0;

  const emit = (next: number) => {
    let clamped = next;
    if (min != null) clamped = Math.max(min, clamped);
    if (max != null) clamped = Math.min(max, clamped);
    onChange({
      target: { value: String(clamped), name: name ?? "" },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const adjust = (delta: number) => {
    const rounded =
      step >= 1
        ? Math.round((numeric + delta) / step) * step
        : Math.round((numeric + delta) / step) * step;
    emit(rounded);
  };

  const downDisabled =
    disabled || (min != null && numeric <= min);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        id={id}
        name={name}
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("min-w-0 flex-1 font-mono tabular-nums", inputClassName)}
      />
      <StepperButtons
        label={ariaLabel}
        onUp={() => adjust(step)}
        onDown={() => adjust(-step)}
        upDisabled={disabled || (max != null && numeric >= max)}
        downDisabled={downDisabled}
      />
    </div>
  );
}

export function NumberStepperField({
  id,
  name,
  label,
  ...inputProps
}: NumberStepperInputProps & { label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NumberStepperInput id={id} name={name} ariaLabel={label} {...inputProps} />
    </div>
  );
}

type PercentStepperInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  showSuffix?: boolean;
  ariaLabel?: string;
};

export function PercentStepperInput({
  id,
  name,
  value,
  onChange,
  step = 0.25,
  min = 0,
  max = 100,
  className,
  inputClassName,
  disabled = false,
  placeholder,
  showSuffix = true,
  ariaLabel = "Prozent",
}: PercentStepperInputProps) {
  const parsed = parseFloat(value.replace(",", ".")) || 0;

  const emit = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    const text =
      step >= 1
        ? String(Math.round(clamped))
        : String(Math.round(clamped / step) * step).replace(/\.?0+$/, "");
    onChange({
      target: { value: text, name: name ?? "" },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const adjust = (delta: number) => {
    emit(Math.round((parsed + delta) / step) * step);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("w-24 font-mono tabular-nums", inputClassName)}
      />
      {showSuffix ? (
        <span className="shrink-0 text-sm text-muted-foreground">%</span>
      ) : null}
      <StepperButtons
        label={ariaLabel}
        onUp={() => adjust(step)}
        onDown={() => adjust(-step)}
        upDisabled={disabled || parsed >= max}
        downDisabled={disabled || parsed <= min}
      />
    </div>
  );
}

export function PercentStepperField({
  id,
  name,
  label,
  ...inputProps
}: PercentStepperInputProps & { label: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <PercentStepperInput id={id} name={name} ariaLabel={label} {...inputProps} />
    </div>
  );
}

/** Prozent als Zahl (Szenario-Overrides) */
export function PercentStepperNumberInput({
  value,
  onChange,
  step = 0.25,
  max = 100,
  min = 0,
  disabled = false,
  className,
  inputClassName,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  min?: number;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const roundToStep = (v: number) => Math.round(v / step) * step;
  const clamp = (v: number) => Math.min(max, Math.max(min, roundToStep(v)));

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        type="number"
        className={cn("w-24 font-mono", inputClassName)}
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          if (disabled) return;
          onChange(clamp(parseFloat(e.target.value) || 0));
        }}
      />
      <span className="shrink-0 text-sm text-muted-foreground">%</span>
      <StepperButtons
        label="Prozent"
        onUp={() => onChange(clamp(value + step))}
        onDown={() => onChange(clamp(value - step))}
        upDisabled={disabled || value >= max}
        downDisabled={disabled || value <= min}
      />
    </div>
  );
}

/** CHF text field without prefix (e.g. koordinierter Lohn) */
export function PlainChfStepperInput({
  id,
  name,
  value,
  onChange,
  step = 1_000,
  min = 0,
  allowZero = true,
  className,
  inputClassName,
  disabled = false,
  placeholder,
  ariaLabel = "Betrag",
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  allowZero?: boolean;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const adjust = (delta: number) => {
    const parsed = parseSwissNumber(value);
    const next = Math.max(min, parsed + delta);
    onChange(formatSwissNumber(next, allowZero));
  };

  const parsed = parseSwissNumber(value);
  const downDisabled = disabled || parsed <= min;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("min-w-0 flex-1 font-mono tabular-nums", inputClassName)}
      />
      <StepperButtons
        label={ariaLabel}
        onUp={() => adjust(step)}
        onDown={() => adjust(-step)}
        upDisabled={disabled}
        downDisabled={downDisabled}
      />
    </div>
  );
}
