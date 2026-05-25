import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ensureFolderStructure,
  getRepoFolderName,
  getSuggestedDownloadPath,
} from "./download.ts";

describe("download path helpers", () => {
  it("sanitizes repository folder segments", () => {
    assert.equal(getRepoFolderName("owner:name", "repo/name"), "owner_name-repo_name");
    assert.equal(getRepoFolderName("   ", "*?"), "owner-__");
    assert.equal(getRepoFolderName("CON", "LPT1"), "CON_-LPT1_");
  });

  it("builds suggested paths with sanitized file names and versions", () => {
    assert.equal(
      getSuggestedDownloadPath("owner", "repo", "release.exe", "v1.2.3"),
      "owner-repo/release-1.2.3.exe"
    );
    assert.equal(
      getSuggestedDownloadPath("owner", "repo", "release", "1/2:3"),
      "owner-repo/release-1_2_3"
    );
    assert.equal(
      getSuggestedDownloadPath("owner", "repo", ".env", "v1"),
      "owner-repo/.env-1"
    );
    assert.equal(
      getSuggestedDownloadPath("owner", "repo", "archive.tar.gz"),
      "owner-repo/archive.tar.gz"
    );
  });

  it("adds the repository folder to Unix-style selected paths", () => {
    assert.equal(
      ensureFolderStructure("/tmp/downloads/app.exe", "owner", "repo"),
      "/tmp/downloads/owner-repo/app.exe"
    );
  });

  it("adds the repository folder to Windows-style selected paths", () => {
    assert.equal(
      ensureFolderStructure("C:\\Downloads\\app.exe", "owner", "repo"),
      "C:\\Downloads\\owner-repo\\app.exe"
    );
  });

  it("does not duplicate an existing repository folder", () => {
    assert.equal(
      ensureFolderStructure("/tmp/downloads/owner-repo/app.exe", "owner", "repo"),
      "/tmp/downloads/owner-repo/app.exe"
    );
    assert.equal(
      ensureFolderStructure("owner-repo/app.exe", "owner", "repo"),
      "owner-repo/app.exe"
    );
  });

  it("sanitizes the selected file name when rebuilding a selected path", () => {
    assert.equal(
      ensureFolderStructure("/tmp/downloads/bad:name.exe", "owner", "repo"),
      "/tmp/downloads/owner-repo/bad_name.exe"
    );
  });
});
