#!/usr/bin/env node
import { verifyPromotionArtifact } from "./lib/deployment-validation.mjs";

const directory = process.env.ARTIFACT_DIR ?? "dist";
const expected = process.env.STAGING_SHA ?? "";
const checkout = process.env.CHECKOUT_SHA ?? "";
const result = verifyPromotionArtifact(directory, expected, checkout);
console.log(`verified promoted bundle ${result.sha} (${result.workerSha256})`);
