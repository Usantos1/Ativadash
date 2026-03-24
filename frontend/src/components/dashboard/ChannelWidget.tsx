import { ChannelSummaryWidget, type ChannelSummaryWidgetProps } from "./ChannelSummaryWidget";

/**
 * Alias semântico para widgets Meta/Google no dashboard — mesma API que {@link ChannelSummaryWidget}.
 */
export type ChannelWidgetProps = ChannelSummaryWidgetProps;

export function ChannelWidget(props: ChannelWidgetProps) {
  return <ChannelSummaryWidget {...props} />;
}
