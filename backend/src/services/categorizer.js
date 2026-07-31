function categorize(merchant){
    const name = merchant.toLowerCase();

    const rules = [
        {category: 'Food', keywords: ['swiggy','zomato','dominos','burgerking','pizzahut']},
        {category: 'Transport', keywords: ['uber','ola']},
        {category: 'Shopping', keywords: ['amazon','flipkart','myntra','ajio','meesho']},
        {category: 'Bills & Utilities', keywords: ['airtel','jio','vodafone']},
        {category: 'Health', keywords: ['apollo','pharmacy','medplus']}
    ];
    for (const rule of rules){
        for(const keyword of rule.keywords){
            if(name.includes(keyword)){
                return rule.category;
            }
        }
    }
    return 'General';
}

module.exports = {categorize};