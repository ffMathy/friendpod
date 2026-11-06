/**
 * The design system's building blocks, in one import: `import { Screen, Title, Button } from '@/components/ui'`.
 * Every string they render is passed in by the caller, already translated (the few built-in strings, such as
 * "Step 2 of 6", "Back" and "(optional)", come from the `common` translations).
 *
 * Tokens (colours, type scale, spacing, radii) live in './theme'; icons in './Icon'. See apps/mobile/README.md.
 */
export { Avatar, AvatarStack, type AvatarProps, type AvatarStackPerson } from './Avatar';
export { BackButton, Button, CloseButton, IconButton, InlineLink, TextLink, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export { Banner, Card, Divider, EmptyState, Illustration, SectionHeader, type BannerTone, type CardVariant } from './Card';
export { Badge, Chip, ChipButton, ChipRow, Tag, type BadgeTone } from './Chip';
export { Checkbox, ChoiceChip, Radio, SegmentedControl, Switch, Toggle } from './Controls';
export { Icon, ICONS, type IconName } from './Icon';
export { ListRow, ListSection, LinkRow, type ListRowProps } from './ListRow';
export { Logo, PodDots } from './Logo';
export { ProgressBar, ProgressSegments } from './Progress';
export { Loading, PageHeader, Screen, Sheet, StepHeader, type ScreenProps } from './Screen';
export { Body, Display, ErrorText, Eyebrow, Heading, Headline, Label, Lede, Muted, Overline, Small, Strong, Text, Title, type TextProps } from './Text';
export { Field, TextField, type FieldProps, type TextFieldProps } from './TextField';
