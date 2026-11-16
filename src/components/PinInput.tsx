export function PinInput({ name, label, autoFocus }: { name: string; label: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="field text-center text-2xl tracking-[0.6em]"
        name={name}
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        autoComplete="off"
        placeholder="••••"
        required
        autoFocus={autoFocus}
      />
    </label>
  );
}
