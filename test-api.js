import { POST } from './src/pages/api/check-duplicate-course.js';

async function test() {
  const req = new Request('http://localhost/api/check-duplicate-course', {
    method: 'POST',
    body: JSON.stringify({ url: 'https://youtube.com/playlist?list=PLyMom0n-MBroupZiLfVSZqK5asX8KfoHL&si=-2XjdJs9TVK-3Dub' })
  });
  const res = await POST({ request: req });
  console.log(res.status);
  console.log(await res.text());
}
test();
