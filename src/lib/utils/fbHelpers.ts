import fs from 'fs';
import GroupPost from '../models/groupPost';

export function generateFacebookGroupURLById(id: number): string {
  return `https://m.facebook.com/groups/${id}/`;
}
/**
 * Function gets old publications.
 * @namespace getOldPublications
 * @param {type} fileName name of the file
 * @return {Object[]} returns the list of all publications.
 * */
export function getOldPublications(fileName: string): GroupPost[] {
  let allPublicationsList;
  if (fs.existsSync(fileName)) {
    // If file exists
    allPublicationsList = JSON.parse(
      fs.readFileSync(fileName, { encoding: 'utf8' }),
    );
  } else {
    // If file does not exists
    allPublicationsList = [];
  }
  return allPublicationsList;
}

/**
 * Function pauses the main execution for given number of seconds
 * @param duration The sleep duration
 */
export async function sleep(duration: number): Promise<void> {
  return new Promise(((resolve) => {
    setTimeout(resolve, duration);
  }));
}

/**
 * Function automatically infinite scrolls and sleeps
 */
export async function autoScroll(): Promise<void> {
  for (let i = 0; i < Math.round((Math.random() * 10) + 10); i += 1) {
    window.scrollBy(0, document.body.scrollHeight);
    // eslint-disable-next-line no-await-in-loop
    await sleep(
      Math.round(
        (Math.random() * 4000) + 1000,
      ),
    );
  }
  await Promise.resolve();
}
