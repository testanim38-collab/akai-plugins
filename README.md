# Valenced Plugins

Plugins for Valenced, the mobile Discord client mod. A mix of original plugins and ports.

## Install

Add this URL as a plugin repository in Valenced:

```
https://hakuxyz.github.io/valenced-plugins/index.json
```

Then open the repository in Valenced and install the plugins you want.

[Source Code](https://github.com/hakuxyz/valenced-plugins)

## Plugins

### Compact Mode

**Version:** 1.0.4

Remove the large message header and show the username inline with the message content. A port of the Vendetta compact mode layout.

- **Inline header.** Usernames, timestamps, avatars and role tags sit with the message text.
- **Flexible layout.** Put the username on its own line above the message if you prefer.
- **Reply cleanup.** Remove avatars from the replied-to message previews.
- **Local settings.** Every option is controlled from the plugin settings.

The inline name is plain text, so tapping it does not open a profile. Changes apply to newly rendered messages. Reload the channel if old messages keep their previous layout.

### Fake Profile Themes

**Version:** 1.2.1

Show profile colors hidden in bios with invisible 3y3 text. A port of ryan's FakeProfileThemes for Vendetta, compatible with bios from Vencord, Vendetta and Revenge.

- **Color picker in the profile editor.** Open your profile editor and pick a primary and accent color with Discord's own color picker. No hex codes needed.
- **Copy 3y3.** Copy the hidden text and paste it anywhere in your bio.
- **Live preview on your profile.** Your own profile shows the selected colors right away.
- **Nitro friendly.** Optional setting to keep your real Nitro colors if a profile has both.

**Note:** The color picker can sometimes fail to open in the plugin settings. If that happens, open your profile editor once (the picker loads with it) and then try again in the plugin settings. This usually only needs to be done once per app launch.

The plugin is CC0. The original authors are credited in the manifest, LICENSE and NOTICE files.

### Force Owner Crown

**Version:** 1.0.1

Shows the owner crown next to usernames, even in large servers where Discord normally hides it. A port of Vencord's ForceOwnerCrown, with the crown drawn locally.

The plugin is CC0.

### FixLinks

**Version:** 1.0.3

Rewrite social media links to embed-friendly domains before a message is sent or edited.

- **Eight platforms.** Twitter, X, TikTok, Bluesky, Instagram, Reddit, Threads and Pixiv.
- **Per-platform switches.** Turn every platform on or off independently.
- **Custom replacement links.** Point a platform at your own domain or instance URL.
- **Safe rewriting.** Already fixed links are left alone, and a master switch disables the plugin at any time.

**Default domains:** `fxtwitter.com`, `fixupx.com`, `tnktok.com`, `fxbsky.app`, `ddinstagram.com`, `redditez.com`, `fixthreads.net` and `phixiv.net`. Threads and Pixiv are off by default.

### Local OG Nitro Icon

**Version:** 1.0.2

Locally show the original Nitro badge icon and adjust Nitro Premium badge behavior.

- **Nitro Basic and Nitro Premium.** Choose whether the plugin applies to Nitro Basic, Nitro Premium or both.
- **Nitro Premium behavior.** Force the original starter Nitro icon, or replace only the starter badge and keep other evolved badges.
- **Affect Your badges.** Optionally apply the selected Nitro Premium behavior to your own badges (Your badges area).
- **Local only.** Changes depend on the badge and profile data Discord provides to the client.

### Messagebox Typing History

**Version:** 1.0.1

Undo and redo the text you typed in the message box, with buttons and gestures.

- **Undo and redo buttons.** A small pill above the message box lets you step back and forward through your typed text.
- **Gestures.** Two-finger tap to undo, with hold or double-tap to redo.
- **Per-channel history.** Your typing history is kept separately for each channel.
- **Customizable.** Configure button position, size, visibility and gesture behavior in the plugin settings.

### No Top Emojis

**Version:** 1.0.0

Hide the Top Emojis in Server category so Favorites stays first in the emoji picker.

- **Favorites first.** Removes the top emoji section from the picker.
- **Clean list.** The header and its emoji rows are removed together, so no empty section is left behind.

### Oneko

**Version:** 1.0.1

A little cat that chases your touches around the app, inspired by the classic Oneko plugin.

- **Follows your touches.** The cat runs to where you tap on screen.
- **Idle animations.** Sleeps and scratches when idle.
- **Customizable.** Change size, speed and sleep behavior in the plugin settings.

### Server Notes

**Version:** 1.2.0

Add notes and custom color tags to servers to keep track of them.

- **Notes per server.** Add, edit or remove a note for any server.
- **Color tags.** Choose from preset colors or pick any custom color.
- **Easy to access.** Manage notes from the plugin settings and, when available, from the server menu.
- **Local storage.** Notes and tags are stored locally on this device.

The plugin is CC0.

### Shut Up Clyde

**Version:** 1.0.1

Block Clyde error messages and remove common Nitro upsell prompts and popups. Inspired by the Aliucord plugin of the same name.

- **Clyde errors.** Prevent local Clyde error messages from appearing in chat.
- **Clyde bot messages.** Optionally filter messages posted by the Clyde bot.
- **Gift button.** Remove the Nitro gift shortcut from the chat composer.
- **Nitro upsells.** Hide known Nitro cards, banners and purchase prompts where Discord exposes them.
- **Local settings.** Every switch is controlled from the plugin settings.

Some prompts depend on the Discord version. Reload the affected screen if a prompt stays visible.

## Bugs and Ideas

Found a bug? Let me know, or report it on GitHub. Have an idea for a new plugin or something you would love to see ported? Feel free to reach out and share your suggestion.
