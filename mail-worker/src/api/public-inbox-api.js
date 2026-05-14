import app from '../hono/hono';
import emailService from '../service/email-service';
import result from '../model/result';

app.get('/public-inbox/list', async (c) => {
	const data = await emailService.publicInboxList(c, c.req.query());
	return c.json(result.ok(data));
});

app.get('/public-inbox/latest', async (c) => {
	const list = await emailService.publicInboxLatest(c, c.req.query());
	return c.json(result.ok(list));
});

app.get('/public-inbox/random', async (c) => {
	const data = await emailService.publicInboxRandom(c);
	return c.json(result.ok(data));
});

app.get('/public-inbox/detail', async (c) => {
	const data = await emailService.publicInboxDetail(c, c.req.query());
	return c.json(result.ok(data));
});
