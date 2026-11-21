import { Stores } from '@valenced/discord/flux'

export interface Named {
  id: string
  name: string
  userId?: string
}

const store = (name: string): any => (Stores as any)[name]

export function userName(id: string) {
  const user = store('UserStore')?.getUser?.(id)
  return user?.globalName ?? user?.global_name ?? user?.username ?? id
}

export function recipientIds(channel: any): string[] {
  const list = channel?.recipients ?? channel?.rawRecipients ?? []
  return (list as any[]).map(item => (typeof item === 'string' ? item : item?.id)).filter(Boolean)
}

export function isDmChannel(channel: any) {
  return channel?.type === 1 || channel?.type === 3
}

export function dmLabel(channel: any) {
  if (channel?.name) return channel.name as string
  const ids = recipientIds(channel)
  return ids.length ? ids.map(userName).join(', ') : String(channel?.id ?? 'DM')
}

export function listGuilds(): Named[] {
  const map = store('GuildStore')?.getGuilds?.() ?? {}
  return (Object.values(map) as any[])
    .filter(guild => guild?.id)
    .map(guild => ({ id: String(guild.id), name: String(guild.name ?? guild.id) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function listDms(): Named[] {
  const channels = store('ChannelStore')
  const map = channels?.getMutablePrivateChannels?.() ?? {}
  return (Object.values(map) as any[])
    .filter(channel => channel?.id && isDmChannel(channel))
    .map(channel => {
      const ids = recipientIds(channel)
      return { id: String(channel.id), name: dmLabel(channel), userId: channel.type === 1 && ids.length === 1 ? ids[0] : undefined }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function resolveDm(input: string): Named {
  const channels = store('ChannelStore')
  const asChannel = channels?.getChannel?.(input)
  if (asChannel && isDmChannel(asChannel)) {
    const ids = recipientIds(asChannel)
    return { id: String(asChannel.id), name: dmLabel(asChannel), userId: asChannel.type === 1 && ids.length === 1 ? ids[0] : undefined }
  }
  const channelId = channels?.getDMFromUserId?.(input)
  if (channelId) return { id: String(channelId), name: userName(input), userId: input }
  return { id: input, name: userName(input), userId: input }
}

export function guildName(id: string) {
  return store('GuildStore')?.getGuild?.(id)?.name as string | undefined
}

export function channelName(id: string) {
  const channel = store('ChannelStore')?.getChannel?.(id)
  return channel?.name ? `#${channel.name}` : undefined
}

export function currentChannel() {
  const id = store('SelectedChannelStore')?.getChannelId?.()
  return id ? store('ChannelStore')?.getChannel?.(id) : undefined
}
