import { generateConceptsFromTopic } from './src/app/utils/geminiApi.ts';

async function test() {
  try {
    const res = await generateConceptsFromTopic("Machine Learning");
    console.log(JSON.stringify(res, null, 2));
  } catch(e) {
    console.error("ERROR:");
    console.error(e);
  }
}
test();
