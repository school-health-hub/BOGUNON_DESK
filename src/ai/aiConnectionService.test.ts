import { describe, expect, it, vi } from "vitest";
import {
  AI_AUTH_ERROR,
  AI_CONNECTION_ERROR,
  AI_NOT_CONNECTED_ERROR,
  AI_TIMEOUT_ERROR,
  createAiConnectionService,
} from "./aiConnectionService";

const input = {
  provider: "openai" as const,
  model: "gpt-5.6-luna",
  apiKey: "fake-test-key",
};

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

describe("memory-only AI connection service", () => {
  it("starts disconnected for every fresh service", () => {
    expect(createAiConnectionService(vi.fn()).getState().status).toBe("disconnected");
    expect(createAiConnectionService(vi.fn()).getState()).toEqual({
      status: "disconnected",
      provider: null,
      model: null,
      error: null,
      canRetry: false,
    });
  });

  it("publishes checking and connected states without exposing the key", async () => {
    let finish: (() => void) | undefined;
    const validation = new Promise<void>((resolve) => { finish = resolve; });
    const service = createAiConnectionService(() => validation);
    const pending = service.connect(input);

    expect(service.getState()).toMatchObject({ status: "checking", provider: "openai", model: "gpt-5.6-luna" });
    expect(JSON.stringify(service.getState())).not.toContain(input.apiKey);
    finish?.();
    await pending;
    expect(service.getState()).toMatchObject({ status: "connected", provider: "openai", model: "gpt-5.6-luna" });
    expect(JSON.stringify(service.getState())).not.toContain(input.apiKey);
  });

  it.each([
    [AI_AUTH_ERROR, AI_AUTH_ERROR],
    [AI_TIMEOUT_ERROR, AI_TIMEOUT_ERROR],
    ["raw provider response with fake-test-key", AI_CONNECTION_ERROR],
  ])("normalizes failed validation safely", async (nativeError, expected) => {
    const service = createAiConnectionService(vi.fn(async () => { throw new Error(nativeError); }));
    await service.connect(input);
    expect(service.getState()).toMatchObject({ status: "failed", error: expected, canRetry: false });
    expect(JSON.stringify(service.getState())).not.toContain(input.apiKey);
  });

  it("revalidates a successful in-memory connection and disconnects immediately", async () => {
    const validate = vi.fn(async () => undefined);
    const service = createAiConnectionService(validate);
    await service.connect(input);
    await service.validate();
    expect(validate).toHaveBeenCalledTimes(2);
    expect(service.getState().status).toBe("connected");

    service.disconnect();
    expect(service.getState().status).toBe("disconnected");
    await service.validate();
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("rejects generation while disconnected", async () => {
    const service = createAiConnectionService(vi.fn(), vi.fn());
    await expect(service.generateText("공문 작성")).rejects.toThrow(AI_NOT_CONNECTED_ERROR);
  });

  it.each([
    [input, "OpenAI 결과"],
    [{ provider: "gemini" as const, model: "gemini-3.8-flash", apiKey: "fake-gemini-key" }, "Gemini 결과"],
  ])("generates through the connected provider without exposing the key", async (connection, generatedText) => {
    const generate = vi.fn(async () => generatedText);
    const service = createAiConnectionService(vi.fn(async () => undefined), generate);
    await service.connect(connection);

    await expect(service.generateText("공문 작성 프롬프트")).resolves.toBe(generatedText);
    expect(generate).toHaveBeenCalledWith({ ...connection, prompt: "공문 작성 프롬프트" });
    expect(JSON.stringify(service.getState())).not.toContain(connection.apiKey);
  });

  it("normalizes generation failures without leaking provider details", async () => {
    const generate = vi.fn(async () => { throw new Error("raw response fake-test-key"); });
    const service = createAiConnectionService(vi.fn(async () => undefined), generate);
    await service.connect(input);
    await expect(service.generateText("공문 작성")).rejects.toThrow(AI_CONNECTION_ERROR);
  });

  it("keeps the latest successful connection when an older request finishes later", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const validate = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const service = createAiConnectionService(validate);
    const firstPending = service.connect(input);
    const secondInput = { provider: "gemini" as const, model: "gemini-3.8-flash", apiKey: "second-key" };
    const secondPending = service.connect(secondInput);

    second.resolve();
    await secondPending;
    first.resolve();
    await firstPending;

    expect(service.getState()).toMatchObject({ status: "connected", provider: "gemini", model: "gemini-3.8-flash" });
  });

  it("ignores an older failed connection after a newer request succeeds", async () => {
    const first = deferred<void>();
    const service = createAiConnectionService(vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(undefined));
    const firstPending = service.connect(input);
    await service.connect({ provider: "gemini", model: "gemini-3.8-flash", apiKey: "second-key" });

    first.reject(new Error(AI_AUTH_ERROR));
    await firstPending;

    expect(service.getState()).toMatchObject({ status: "connected", provider: "gemini" });
  });

  it("keeps the latest failure when an older request succeeds later", async () => {
    const first = deferred<void>();
    const service = createAiConnectionService(vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockRejectedValueOnce(new Error(AI_AUTH_ERROR)));
    const firstPending = service.connect(input);
    await service.connect({ provider: "gemini", model: "gemini-3.8-flash", apiKey: "second-key" });

    first.resolve();
    await firstPending;

    expect(service.getState()).toMatchObject({ status: "failed", provider: "gemini", error: AI_AUTH_ERROR });
  });

  it("does not reconnect when a pending validation finishes after disconnect", async () => {
    const validation = deferred<void>();
    const service = createAiConnectionService(() => validation.promise);
    const pending = service.connect(input);

    service.disconnect();
    validation.resolve();
    await pending;

    expect(service.getState()).toEqual({
      status: "disconnected",
      provider: null,
      model: null,
      error: null,
      canRetry: false,
    });
  });
});
