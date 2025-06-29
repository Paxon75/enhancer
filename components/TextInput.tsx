import React from 'react';

interface TextInputProps {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  className?: string;
  disabled?: boolean;
}

interface TextAreaProps {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

const TextInput: React.FC<TextInputProps> = ({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  min,
  className = '',
  disabled = false
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-secondary-300">
        {label}
      </label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        disabled={disabled}
        className="block w-full px-4 py-2.5 bg-secondary-800 border border-secondary-700 rounded-lg text-secondary-100 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
};

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
  disabled = false
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-secondary-300">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="block w-full px-4 py-2.5 bg-secondary-800 border border-secondary-700 rounded-lg text-secondary-100 placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-150 resize-vertical disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
};

export default TextInput;