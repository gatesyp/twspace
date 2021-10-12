import axios from 'axios'
// eslint-disable-next-line camelcase
import child_process from 'child_process'
import fs from 'fs'
import path from 'path'
import { config } from './config'
import logger from './logger'
import { Util } from './util'

export class Downloader {
  public static getMediaDir(): string {
    const dir = path.join(__dirname, config.app.mediaDir)
    return dir
  }

  public static createMediaDir(): string {
    return fs.mkdirSync(this.getMediaDir(), { recursive: true })
  }

  public static async downloadMedia(url: string, fileName: string): Promise<void> {
    const masterUrl = Util.getStreamMasterUrlFromDynamicUrl(url)
    const playlistFileName = `${fileName}.m3u8`
    const mediaFileName = `${fileName}.aac`
    logger.info(`StreamMasterUrl: ${masterUrl}`)
    await this.downloadMediaPlaylist(masterUrl, playlistFileName)
    this.runFfmpeg(
      path.join(this.getMediaDir(), playlistFileName),
      path.join(this.getMediaDir(), mediaFileName),
    )
  }

  public static async downloadMediaPlaylist(url: string, fileName: string): Promise<void> {
    const data = await this.getMediaPlaylist(url)
    const filePath = path.join(this.getMediaDir(), fileName)
    this.createMediaDir()
    fs.writeFileSync(filePath, data)
    logger.info(`[Playlist] Saved to: ${filePath}`)
  }

  public static async getMediaPlaylist(url: string): Promise<string> {
    let res = await axios.get<string>(url)
    let { data } = res
    const playlistOrigin = new URL(url).origin
    const playlistSuffix = data.split('\n')[3]
    const playlistUrl = playlistOrigin + playlistSuffix
    logger.info(`StreamPlaylisUrl: ${playlistUrl}`)
    res = await axios.get<string>(playlistUrl)
    data = res.data
    const chunkRegex = /^chunk/gm
    logger.info(`StreamPlaylisContentLength: ${Number(res.headers['content-length'])}`)
    logger.info(`StreamPlaylisChunkCount: ${data.match(chunkRegex).length}`)
    const masterUrlWithoutExt = url.replace('master_playlist.m3u8', '')
    const playlistFormatData = data.replace(chunkRegex, `${masterUrlWithoutExt}chunk`)
    return playlistFormatData
  }

  public static runFfmpeg(playlistPath: string, mediaPath: string): void {
    const cmd = 'ffmpeg'
    const args = [
      '-protocol_whitelist',
      'file,https,tls,tcp',
      '-i',
      playlistPath,
      '-c',
      'copy',
      mediaPath,
    ]
    logger.info(`[Audio] Saving to: ${mediaPath}`)
    logger.info(`${cmd} ${args.join(' ')}`)
    this.createMediaDir()
    const cp = process.platform === 'win32'
      ? child_process.spawn('cmd', ['/c', [cmd, ...args].join(' ')], { detached: true, stdio: 'ignore' })
      : child_process.spawn(cmd, args, { stdio: 'ignore' })
    cp.unref()
  }
}
