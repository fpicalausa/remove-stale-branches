import { exec } from "child_process";

describe("CLI", () => {
  test("should run without errors", (done) => {
    exec("ts-node src/cli.ts", (error, stdout, stderr) => {
      expect(error).toBeNull();
      expect(stderr).toBe("");
      done();
    });
  });

  // Additional tests can be added to verify environment variable handling and CLI options
});
