import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * A custom Select component built on Radix UI to replace native `<select>`.
 * Supports drop-in replacement for basic `<select>` usage, including `onChange` mimicking `e.target.value`.
 */
export const Select = React.forwardRef(({ children, value, onChange, placeholder, className, disabled, ...props }, ref) => {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(val) => {
        if (onChange) {
          // Mock an event object for drop-in compatibility with (e) => setVal(e.target.value)
          onChange({ target: { value: val } });
        }
      }}
      disabled={disabled}
      {...props}
    >
      <SelectPrimitive.Trigger
        ref={ref}
        className={`w-full flex items-center justify-between rounded-xl bg-white/5 border border-white/10 text-white text-xs py-3 px-4 outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content 
          className="overflow-hidden bg-[#111827] border border-white/10 rounded-xl shadow-lg z-[100] text-xs text-white"
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-[25px] bg-[#111827] text-white cursor-default">
            <ChevronUp className="h-4 w-4" />
          </SelectPrimitive.ScrollUpButton>
          
          <SelectPrimitive.Viewport className="p-1 max-h-[300px]">
            {children}
          </SelectPrimitive.Viewport>
          
          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-[25px] bg-[#111827] text-white cursor-default">
            <ChevronDown className="h-4 w-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
});
Select.displayName = 'Select';

export const SelectItem = React.forwardRef(({ children, className, ...props }, ref) => {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={`relative flex items-center w-full px-8 py-2 text-xs text-white rounded-lg select-none outline-none focus:bg-white/10 cursor-pointer data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className || ''}`}
      {...props}
    >
      <span className="absolute left-2 flex items-center justify-center w-4 h-4">
        <SelectPrimitive.ItemIndicator>
          <Check className="w-3 h-3 text-[#10b981]" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = 'SelectItem';
