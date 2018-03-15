export function shuffle(array: Array<any>) {
    let currentIndex = array.length;
    let temporaryValue, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
}

export function make2DNumberArray(x: number, y: number) {
    const arr = new Array<Array<number>>();
    for (let i = 0; i < x; i++) {
      arr[i] = new Array<number>();
      for (let j = 0; j < y; j++) {
        arr[i][j] = 0;
      }
    }
    return arr;
}