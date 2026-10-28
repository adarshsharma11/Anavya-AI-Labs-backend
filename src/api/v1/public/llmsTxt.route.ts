import { Hono } from 'hono';
import {
  checkUrlHandler,
  generateHandler,
  validateContentHandler,
} from '../../../modules/llmsTxt/llmsTxt.controller.js';

const llmsTxtRoute = new Hono();

// Content Validation API
llmsTxtRoute.post('/tools/llms-txt/validate', validateContentHandler);

// Published URL Checker API
llmsTxtRoute.post('/tools/llms-txt/check-url', checkUrlHandler);

// llms.txt Generator API
llmsTxtRoute.post('/tools/llms-txt/generate', generateHandler);

export default llmsTxtRoute;
