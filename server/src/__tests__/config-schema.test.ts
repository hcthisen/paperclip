import { describe, expect, it } from "vitest";
import { paperclipConfigSchema } from "@paperclipai/shared";

describe("paperclipConfigSchema", () => {
  it("accepts legacy vps-bootstrap config metadata", () => {
    const config = paperclipConfigSchema.parse({
      $meta: {
        version: 1,
        updatedAt: "2026-04-04T19:00:00Z",
        source: "vps-bootstrap",
      },
      database: {
        mode: "embedded-postgres",
        embeddedPostgresDataDir: "/tmp/paperclip/db",
        embeddedPostgresPort: 54329,
        backup: {
          enabled: true,
          intervalMinutes: 60,
          retentionDays: 30,
          dir: "/tmp/paperclip/backups",
        },
      },
      logging: {
        mode: "file",
        logDir: "/tmp/paperclip/logs",
      },
      server: {
        deploymentMode: "authenticated",
        exposure: "public",
        host: "0.0.0.0",
        port: 3100,
        allowedHostnames: [],
        serveUi: true,
      },
      auth: {
        baseUrlMode: "explicit",
        publicBaseUrl: "https://dashboard.titanclaws.com",
        disableSignUp: false,
      },
      storage: {
        provider: "local_disk",
        localDisk: {
          baseDir: "/tmp/paperclip/storage",
        },
        s3: {
          bucket: "paperclip",
          region: "us-east-1",
          prefix: "",
          forcePathStyle: false,
        },
      },
      secrets: {
        provider: "local_encrypted",
        strictMode: false,
        localEncrypted: {
          keyFilePath: "/tmp/paperclip/master.key",
        },
      },
    });

    expect(config.$meta.source).toBe("vps-bootstrap");
  });
});
