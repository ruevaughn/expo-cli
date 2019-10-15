import path from 'path';

import fs from 'fs-extra';
import { StandaloneBuild, ProjectUtils } from '@expo/xdl';
import chalk from 'chalk';

import { downloadFile } from './utils';
import log from '../../log';
import { ExpoConfig, Platform } from '@expo/config';

export type PlatformOptions = {
  id?: string;
  path?: string;
};

export default class BaseUploader {
  _exp?: ExpoConfig;
  fastlane: { [key: string]: string };

  constructor(
    public platform: Platform,
    public projectDir: string,
    public options: PlatformOptions
  ) {
    // it has to happen in constructor because we don't want to load this module on a different platform than darwin
    this.fastlane = require('@expo/traveling-fastlane-darwin')();
  }

  async upload(): Promise<void> {
    await this._getProjectConfig();
    const buildPath = await this._getBinaryFilePath();
    const platformData = await this._getPlatformSpecificOptions();
    await this._uploadToTheStore(platformData, buildPath);
    await this._removeBuildFileIfDownloaded(buildPath);
    log(
      `Please also see our docs (${chalk.underline(
        'https://docs.expo.io/versions/latest/distribution/uploading-apps/'
      )}) to learn more about the upload process.`
    );
  }

  async _getProjectConfig(): Promise<void> {
    const { exp } = await ProjectUtils.readConfigJsonAsync(this.projectDir);
    if (!exp) {
      throw new Error(`Couldn't read project config file in ${this.projectDir}.`);
    }
    this._ensureExperienceIsValid(exp);
    this._exp = exp;
  }

  async _getBinaryFilePath(): Promise<string> {
    const { path, id } = this.options;
    if (path) {
      return path;
    } else if (id) {
      return this._downloadBuildById(id);
    } else {
      return this._downloadLastestBuild();
    }
  }

  async _downloadBuildById(id: string): Promise<string> {
    const { platform } = this;
    const slug = this._getSlug();
    // @ts-ignore: TODO: Fix the limit param
    const build = await StandaloneBuild.getStandaloneBuilds({ id, slug, platform });
    if (!build) {
      throw new Error(`We couldn't find build with id ${id}`);
    }
    return this._downloadBuild(build.artifacts.url);
  }

  _getSlug(): string {
    if (!this._exp || !this._exp.slug) {
      throw new Error(`slug doesn't exist`);
    }
    return this._exp.slug;
  }

  async _downloadLastestBuild() {
    const { platform } = this;

    const slug = this._getSlug();
    const build = await StandaloneBuild.getStandaloneBuilds({
      slug,
      platform,
      limit: 1,
    });
    if (!build) {
      throw new Error(
        `There are no builds on the Expo servers, please run 'expo build:${platform}' first`
      );
    }
    return this._downloadBuild(build.artifacts.url);
  }

  async _downloadBuild(urlOrPath: string): Promise<string> {
    const filename = path.basename(urlOrPath);
    const destinationPath = `/tmp/${filename}`;
    if (await fs.pathExists(destinationPath)) {
      await fs.remove(destinationPath);
    }
    if (urlOrPath.startsWith('/')) {
      await fs.copy(urlOrPath, destinationPath);
      return destinationPath;
    } else {
      log(`Downloading build from ${urlOrPath}`);
      return await downloadFile(urlOrPath, destinationPath);
    }
  }

  async _removeBuildFileIfDownloaded(buildPath: string): Promise<void> {
    if (!this.options.path) {
      await fs.remove(buildPath);
    }
  }

  _ensureExperienceIsValid(exp: ExpoConfig): void {
    throw new Error('Not implemented');
  }

  async _getPlatformSpecificOptions(): Promise<{ [key: string]: any }> {
    throw new Error('Not implemented');
  }

  async _uploadToTheStore(platformData: PlatformOptions, buildPath: string): Promise<void> {
    throw new Error('Not implemented');
  }
}